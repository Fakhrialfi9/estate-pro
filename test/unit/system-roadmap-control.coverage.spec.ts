import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';
import { SystemRoadmapControlService } from '../../src/modules/system/application/services/system-roadmap-control.service.js';

const integrationRow = {
  id: 11n,
  uuid: 'integration-1',
  providerKey: 'crm',
  state: 'HEALTHY',
  lastTestAt: new Date('2026-01-01T01:00:00.000Z'),
  lastSyncAt: new Date('2026-01-01T02:00:00.000Z'),
  errorCode: null,
};

const createDependencies = () => {
  const roadmap = {
    aggregate: vi.fn().mockResolvedValue({ total: 4, active: 3 }),
    featureFlag: {
      list: vi.fn().mockResolvedValue([{ key: 'new-ui', enabled: true }]),
      upsert: vi.fn().mockImplementation(async (input) => ({ id: 'flag-1', ...input })),
      get: vi.fn(),
    },
    importProfile: {
      create: vi.fn().mockImplementation(async (input) => ({ id: 'profile-1', ...input })),
      list: vi.fn().mockResolvedValue([{ id: 'profile-1' }]),
      get: vi.fn(),
      update: vi.fn().mockImplementation(async (uuid, input) => ({ uuid, ...input })),
    },
    credential: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(async (input) => ({ id: 'credential-1', ...input })),
      rotate: vi.fn().mockImplementation(async (uuid, input) => ({ uuid, secretRef: input.secretRef, status: 'ACTIVE' })),
      revoke: vi.fn().mockImplementation(async (uuid) => ({ uuid, secretRef: 'vault://redacted', status: 'REVOKED' })),
    },
    runtime: {
      getOrCreate: vi.fn().mockResolvedValue({
        syncDirection: 'BIDIRECTIONAL',
        requestMapping: {},
        responseMapping: {},
        metadata: {},
        circuitState: 'CLOSED',
        nextRetryAt: null,
        failureCount: 0,
      }),
      update: vi.fn().mockImplementation(async (_id, input) => ({ ...input })),
    },
    operation: {
      getByIdempotency: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (input) => ({ id: 'operation-1', integrationId: 11n, ...input })),
      list: vi.fn().mockResolvedValue([{ id: 'operation-1' }]),
      update: vi.fn().mockImplementation(async (uuid, input) => ({ uuid, integrationId: 11n, ...input })),
    },
    credentialVault: {},
    alert: {
      upsert: vi.fn().mockResolvedValue({ id: 'alert-1' }),
    },
  };

  const integrations = {
    list: vi.fn().mockResolvedValue({ items: [integrationRow] }),
    get: vi.fn().mockResolvedValue(integrationRow),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const config = {
    get: vi.fn((key: string, fallback?: unknown) => key === 'app.environment' ? 'test' : fallback),
  };

  return { roadmap, integrations, audit, config };
};

describe('SystemRoadmapControlService coverage', () => {
  let deps: ReturnType<typeof createDependencies>;
  let service: SystemRoadmapControlService;

  beforeEach(() => {
    vi.restoreAllMocks();
    deps = createDependencies();
    service = new SystemRoadmapControlService(
      deps.roadmap as never,
      deps.integrations as never,
      deps.audit as never,
      deps.config as never,
    );
  });

  it('builds dashboard from roadmap aggregate and integration health', async () => {
    const result = await service.dashboard();
    expect(result.total).toBe(4);
    expect(result.environment).toBe('test');
    expect(result.integrationHealth).toEqual([
      expect.objectContaining({ uuid: 'integration-1', providerKey: 'crm', state: 'HEALTHY' }),
    ]);
    expect(deps.roadmap.aggregate).toHaveBeenCalledOnce();
    expect(deps.integrations.list).toHaveBeenCalledWith({ page: 1, limit: 100 });
  });

  it('returns only safe environment variables and configured fallbacks', () => {
    const original = { ...process.env };
    process.env.APP_ENV = 'staging';
    process.env.APP_VERSION = '1.2.3';
    process.env.BUILD_SHA = 'abc123';
    process.env.REGION = 'id-jkt';
    process.env.LOG_LEVEL = 'debug';
    const result = service.environment();
    expect(result.environment).toBe('test');
    expect(result.version).toBe('1.2.3');
    expect(result.buildSha).toBe('abc123');
    expect(result.region).toBe('id-jkt');
    expect(result.safeVariables).toMatchObject({ APP_ENV: 'staging', APP_VERSION: '1.2.3', BUILD_SHA: 'abc123', REGION: 'id-jkt', LOG_LEVEL: 'debug' });
    process.env = original;
  });

  it('delegates feature flag listing', async () => {
    const rows = await service.listFlags('production');
    expect(rows).toEqual([{ key: 'new-ui', enabled: true }]);
    expect(deps.roadmap.featureFlag.list).toHaveBeenCalledWith('production');
  });

  it('creates validated feature flags and sanitizes optional metadata', async () => {
    const row = await service.setFlag('actor-1', {
      key: 'new-ui',
      environment: 'production',
      enabled: true,
      rolloutPercentage: 150,
      description: '  New UI  ',
      metadata: { safe: 'value' },
    });
    expect(row).toMatchObject({ key: 'new-ui', environment: 'production', enabled: true, rolloutPercentage: 100, description: 'New UI' });
    expect(deps.roadmap.featureFlag.upsert).toHaveBeenCalledOnce();
    expect(deps.audit.record).toHaveBeenCalledOnce();
    await expect(service.setFlag('actor-1', { key: 'bad key', environment: 'production', enabled: true })).rejects.toThrow('Invalid feature flag key');
    await expect(service.setFlag('actor-1', { key: 'valid', environment: 'bad env!', enabled: true })).rejects.toThrow('Invalid environment identifier');
  });

  it('evaluates disabled, full rollout, missing subject and deterministic rollout flags', async () => {
    deps.roadmap.featureFlag.get.mockResolvedValueOnce(null);
    await expect(service.evaluateFlag('missing', 'production')).resolves.toBe(false);

    deps.roadmap.featureFlag.get.mockResolvedValueOnce({ enabled: false, rolloutPercentage: 100 });
    await expect(service.evaluateFlag('disabled', 'production', 'user-1')).resolves.toBe(false);

    deps.roadmap.featureFlag.get.mockResolvedValueOnce({ enabled: true, rolloutPercentage: 100 });
    await expect(service.evaluateFlag('full', 'production')).resolves.toBe(true);

    deps.roadmap.featureFlag.get.mockResolvedValueOnce({ enabled: true, rolloutPercentage: 50 });
    await expect(service.evaluateFlag('partial', 'production')).resolves.toBe(false);

    deps.roadmap.featureFlag.get.mockResolvedValueOnce({ enabled: true, rolloutPercentage: 50 });
    const first = await service.evaluateFlag('partial', 'production', 'user-1');
    deps.roadmap.featureFlag.get.mockResolvedValueOnce({ enabled: true, rolloutPercentage: 50 });
    const second = await service.evaluateFlag('partial', 'production', 'user-1');
    expect(typeof first).toBe('boolean');
    expect(second).toBe(first);

    deps.roadmap.featureFlag.get.mockResolvedValueOnce({ enabled: true, rolloutPercentage: 0 });
    await expect(service.evaluateFlag('zero', 'production', 'user-1')).resolves.toBe(false);
  });

  it('creates, lists, gets and updates import profiles with validated mappings', async () => {
    const row = await service.createImportProfile('actor-1', {
      name: ' Leads ', entity: ' Lead ', version: 0, format: 'csv',
      columnMapping: { email: 'email' }, fieldMapping: { email: 'email' },
      conflictStrategy: 'UPDATE', transactionStrategy: 'PER_ROW', active: true,
    });
    expect(row.name).toBe('Leads');
    expect(row.entity).toBe('Lead');
    expect(row.version).toBe(1);
    expect(row.active).toBe(true);
    expect(deps.audit.record).toHaveBeenCalled();

    await expect(service.getImportProfile('missing')).rejects.toBeInstanceOf(NotFoundException);
    deps.roadmap.importProfile.get.mockResolvedValueOnce({ id: 'profile-1', name: 'old' });
    await expect(service.getImportProfile('profile-1')).resolves.toEqual({ id: 'profile-1', name: 'old' });

    await expect(service.listImportProfiles('Lead', true)).resolves.toEqual([{ id: 'profile-1' }]);
    expect(deps.roadmap.importProfile.list).toHaveBeenCalledWith('Lead', true);

    const updated = await service.updateImportProfile('actor-1', 'profile-1', {
      name: ' Updated ', version: 2, active: false,
      columnMapping: { email: 'email' }, fieldMapping: { phone: 'phone' },
    });
    expect(updated).toMatchObject({ uuid: 'profile-1', name: 'Updated', version: 2, active: false });
    expect(deps.roadmap.importProfile.update).toHaveBeenCalledOnce();
  });

  it('redacts credential references and handles credential lifecycle', async () => {
    deps.roadmap.credential.list.mockResolvedValueOnce([{ uuid: 'c1', secretRef: 'vault://secret/path', status: 'ACTIVE' }]);
    const credentials = await service.credentials('integration-1');
    expect(credentials[0]?.secretRef).not.toBe('vault://secret/path');

    const created = await service.createCredential('actor-1', 'integration-1', {
      credentialType: 'BEARER', secretRef: 'vault://secret/path', metadata: { region: 'id' },
    });
    expect(created.secretRef).not.toBe('vault://secret/path');
    expect(created.version).toBe(1);

    const rotated = await service.rotateCredential('actor-1', 'credential-1', { secretRef: 'vault://new-secret' });
    expect(rotated.secretRef).not.toBe('vault://new-secret');
    await expect(service.revokeCredential('actor-1', 'credential-1')).resolves.toMatchObject({ uuid: 'credential-1', status: 'REVOKED' });
    await expect(service.createCredential('actor-1', 'integration-1', { credentialType: 'BAD', secretRef: 'vault://bad' })).rejects.toThrow();
    await expect(service.createCredential('actor-1', 'integration-1', { credentialType: 'BEARER', secretRef: 'https://not-vault' })).rejects.toThrow();
  });

  it('returns and configures integration runtime', async () => {
    await expect(service.runtime('integration-1')).resolves.toMatchObject({ circuitState: 'CLOSED' });
    const result = await service.configureRuntime('actor-1', 'integration-1', {
      syncDirection: 'PUSH', requestMapping: { email: 'email' }, responseMapping: { id: 'id' }, metadata: { source: 'test' },
    });
    expect(result).toMatchObject({ syncDirection: 'PUSH', requestMapping: { email: 'email' } });
    expect(deps.roadmap.runtime.update).toHaveBeenCalled();
  });

  it('handles idempotent integration operations and circuit breaker states', async () => {
    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({ circuitState: 'OPEN', nextRetryAt: new Date(Date.now() + 60_000), failureCount: 5 });
    await expect(service.operation('actor-1', 'integration-1', { operationKey: 'sync', direction: 'OUTBOUND', idempotencyKey: 'key-1' })).rejects.toThrow('Integration circuit breaker is open');

    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({ circuitState: 'CLOSED', nextRetryAt: null, failureCount: 0 });
    deps.roadmap.operation.getByIdempotency.mockResolvedValueOnce({ id: 'existing' });
    await expect(service.operation('actor-1', 'integration-1', { operationKey: 'sync', direction: 'OUTBOUND', idempotencyKey: 'key-1' })).resolves.toEqual({ id: 'existing' });

    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({ circuitState: 'OPEN', nextRetryAt: new Date(Date.now() - 1_000), failureCount: 5 });
    deps.roadmap.operation.getByIdempotency.mockResolvedValueOnce(null);
    const created = await service.operation('actor-1', 'integration-1', { operationKey: 'sync', direction: 'OUTBOUND', idempotencyKey: 'key-2', maxAttempts: 20, requestPayload: { x: 1 } });
    expect(created).toMatchObject({ state: 'RUNNING', maxAttempts: 10 });
  });

  it('lists and completes operations with runtime recovery', async () => {
    await expect(service.listOperations('integration-1', 'SUCCEEDED', 10)).resolves.toEqual([{ id: 'operation-1' }]);
    const row = await service.completeOperation('actor-1', 'operation-1', { result: 'ok' });
    expect(row).toMatchObject({ state: 'SUCCEEDED', responseHash: expect.any(String) });
    expect(deps.roadmap.runtime.update).toHaveBeenCalled();
  });

  it('fails operations, schedules retry and opens circuit after repeated failures', async () => {
    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({ failureCount: 1, circuitState: 'CLOSED', openedAt: null });
    const retry = await service.failOperation('actor-1', 'operation-1', { code: 'TEMP', message: 'temporary', retryable: true });
    expect(retry.operation.state).toBe('RETRY_SCHEDULED');
    expect(retry.runtime.failureCount).toBe(2);

    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({ failureCount: 4, circuitState: 'CLOSED', openedAt: null });
    const opened = await service.failOperation('actor-1', 'operation-1', { message: 'fatal', retryable: false });
    expect(opened.operation.state).toBe('FAILED');
    expect(opened.runtime.failureCount).toBe(5);
    expect(opened.runtime.circuitState).toBe('OPEN');
    expect(deps.roadmap.alert.upsert).toHaveBeenCalled();
  });
});
