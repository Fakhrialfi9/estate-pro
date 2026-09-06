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

const createDependencies = () => ({
  roadmap: {
    aggregate: vi.fn().mockResolvedValue({ total: 4, active: 3 }),
    featureFlag: {
      list: vi.fn().mockResolvedValue([{ key: 'new-ui', enabled: true }]),
      upsert: vi.fn().mockImplementation((input: Record<string, unknown>) => ({
        id: 'flag-1',
        ...input,
      })),
      get: vi.fn(),
    },
    importProfile: {
      create: vi.fn().mockImplementation((input: Record<string, unknown>) => ({
        id: 'profile-1',
        ...input,
      })),
      list: vi.fn().mockResolvedValue([{ id: 'profile-1' }]),
      get: vi.fn(),
      update: vi
        .fn()
        .mockImplementation((uuid: string, input: Record<string, unknown>) => ({
          uuid,
          ...input,
        })),
    },
    credential: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((input: Record<string, unknown>) => ({
        id: 'credential-1',
        ...input,
      })),
      rotate: vi
        .fn()
        .mockImplementation((uuid: string, input: { secretRef: string }) => ({
          uuid,
          secretRef: input.secretRef,
          status: 'ACTIVE',
        })),
      revoke: vi.fn().mockImplementation((uuid: string) => ({
        uuid,
        secretRef: 'vault://redacted',
        status: 'REVOKED',
      })),
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
      update: vi
        .fn()
        .mockImplementation((_id: string, input: Record<string, unknown>) => ({
          ...input,
        })),
    },
    operation: {
      getByIdempotency: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input: Record<string, unknown>) => ({
        id: 'operation-1',
        integrationId: 11n,
        ...input,
      })),
      list: vi.fn().mockResolvedValue([{ id: 'operation-1' }]),
      update: vi
        .fn()
        .mockImplementation((uuid: string, input: Record<string, unknown>) => ({
          uuid,
          integrationId: 11n,
          ...input,
        })),
    },
    alert: {
      upsert: vi.fn().mockResolvedValue({ id: 'alert-1' }),
    },
  },
  integrations: {
    list: vi.fn().mockResolvedValue({ items: [integrationRow] }),
    get: vi.fn().mockResolvedValue(integrationRow),
  },
  audit: {
    record: vi.fn().mockResolvedValue(undefined),
  },
  config: {
    get: vi.fn((key: string, fallback?: unknown) =>
      key === 'app.environment' ? 'test' : fallback,
    ),
  },
});

describe('SystemRoadmapControlService coverage', () => {
  let deps: ReturnType<typeof createDependencies>;
  let service: SystemRoadmapControlService;

  beforeEach(() => {
    vi.restoreAllMocks();
    deps = createDependencies();
    service = new SystemRoadmapControlService(
      deps.roadmap as never,
      deps.integrations as never,
      deps.audit,
      deps.config as never,
    );
  });

  it('builds dashboard from roadmap aggregate and integrations', async () => {
    const result = await service.dashboard();

    expect(result.total).toBe(4);
    expect(result.environment).toBe('test');
    expect(result.integrationHealth).toEqual([
      expect.objectContaining({
        uuid: 'integration-1',
        providerKey: 'crm',
        state: 'HEALTHY',
      }),
    ]);
    expect(deps.roadmap.aggregate).toHaveBeenCalledOnce();
    expect(deps.integrations.list).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
    });
  });

  it('returns safe environment values', () => {
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
    expect(result.safeVariables).toMatchObject({
      APP_ENV: 'staging',
      APP_VERSION: '1.2.3',
      BUILD_SHA: 'abc123',
      REGION: 'id-jkt',
      LOG_LEVEL: 'debug',
    });
    process.env = original;
  });

  it('covers feature flag lifecycle and rollout decisions', async () => {
    await expect(service.listFlags('production')).resolves.toEqual([
      { key: 'new-ui', enabled: true },
    ]);

    const flag = await service.setFlag('actor-1', {
      key: 'new-ui',
      environment: 'production',
      enabled: true,
      rolloutPercentage: 150,
      description: '  New UI  ',
      metadata: { safe: 'value' },
    });
    expect(flag).toMatchObject({
      key: 'new-ui',
      environment: 'production',
      enabled: true,
      rolloutPercentage: 100,
      description: 'New UI',
    });
    expect(deps.audit.record).toHaveBeenCalled();

    await expect(
      service.setFlag('actor-1', {
        key: 'bad key',
        environment: 'production',
        enabled: true,
      }),
    ).rejects.toThrow('Invalid feature flag key');
    await expect(
      service.setFlag('actor-1', {
        key: 'valid',
        environment: 'bad env!',
        enabled: true,
      }),
    ).rejects.toThrow('Invalid environment identifier');

    deps.roadmap.featureFlag.get.mockResolvedValueOnce(null);
    await expect(service.evaluateFlag('missing', 'production')).resolves.toBe(
      false,
    );
    deps.roadmap.featureFlag.get.mockResolvedValueOnce({
      enabled: false,
      rolloutPercentage: 100,
    });
    await expect(
      service.evaluateFlag('disabled', 'production', 'user-1'),
    ).resolves.toBe(false);
    deps.roadmap.featureFlag.get.mockResolvedValueOnce({
      enabled: true,
      rolloutPercentage: 100,
    });
    await expect(service.evaluateFlag('full', 'production')).resolves.toBe(
      true,
    );
  });

  it('covers import profile lifecycle', async () => {
    const created = await service.createImportProfile('actor-1', {
      name: ' Leads ',
      entity: ' Lead ',
      version: 0,
      format: 'csv',
      columnMapping: { email: 'email' },
      fieldMapping: { email: 'email' },
      conflictStrategy: 'UPDATE',
      transactionStrategy: 'PER_ROW',
      active: true,
    });
    expect(created).toMatchObject({
      name: 'Leads',
      entity: 'Lead',
      version: 1,
      active: true,
    });

    await expect(service.getImportProfile('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    deps.roadmap.importProfile.get.mockResolvedValueOnce({
      id: 'profile-1',
      name: 'old',
    });
    await expect(service.getImportProfile('profile-1')).resolves.toEqual({
      id: 'profile-1',
      name: 'old',
    });
    await expect(service.listImportProfiles('Lead', true)).resolves.toEqual([
      { id: 'profile-1' },
    ]);

    const updated = await service.updateImportProfile('actor-1', 'profile-1', {
      name: ' Updated ',
      version: 2,
      active: false,
      columnMapping: { email: 'email' },
      fieldMapping: { phone: 'phone' },
    });
    expect(updated).toMatchObject({
      uuid: 'profile-1',
      name: 'Updated',
      version: 2,
      active: false,
    });
  });

  it('covers credential, runtime and operation lifecycle', async () => {
    deps.roadmap.credential.list.mockResolvedValueOnce([
      {
        uuid: 'c1',
        secretRef: 'vault://secret/path',
        status: 'ACTIVE',
      },
    ]);
    const credentials = await service.credentials('integration-1');
    expect(credentials[0]?.secretRef).not.toBe('vault://secret/path');

    const created = await service.createCredential('actor-1', 'integration-1', {
      credentialType: 'BEARER',
      secretRef: 'vault://secret/path',
      metadata: { region: 'id' },
    });
    expect(created.secretRef).not.toBe('vault://secret/path');
    expect(created.version).toBe(1);

    const rotated = await service.rotateCredential('actor-1', 'credential-1', {
      secretRef: 'vault://new-secret',
    });
    expect(rotated.secretRef).not.toBe('vault://new-secret');
    await expect(
      service.revokeCredential('actor-1', 'credential-1'),
    ).resolves.toMatchObject({
      uuid: 'credential-1',
      status: 'REVOKED',
    });

    await expect(
      service.createCredential('actor-1', 'integration-1', {
        credentialType: 'BAD',
        secretRef: 'vault://bad',
      }),
    ).rejects.toThrow();

    await expect(service.runtime('integration-1')).resolves.toMatchObject({
      circuitState: 'CLOSED',
    });
    await expect(
      service.configureRuntime('actor-1', 'integration-1', {
        syncDirection: 'PUSH',
        requestMapping: { email: 'email' },
        responseMapping: { id: 'id' },
        metadata: { source: 'test' },
      }),
    ).resolves.toMatchObject({ syncDirection: 'PUSH' });

    await expect(
      service.listOperations('integration-1', 'SUCCEEDED', 10),
    ).resolves.toEqual([{ id: 'operation-1' }]);
  });

  it('covers retry and circuit-breaker operation paths', async () => {
    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({
      circuitState: 'OPEN',
      nextRetryAt: new Date(Date.now() + 60_000),
      failureCount: 5,
    });
    await expect(
      service.operation('actor-1', 'integration-1', {
        operationKey: 'sync',
        direction: 'OUTBOUND',
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow('Integration circuit breaker is open');

    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({
      circuitState: 'CLOSED',
      nextRetryAt: null,
      failureCount: 0,
    });
    deps.roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      id: 'existing',
    });
    await expect(
      service.operation('actor-1', 'integration-1', {
        operationKey: 'sync',
        direction: 'OUTBOUND',
        idempotencyKey: 'key-1',
      }),
    ).resolves.toEqual({ id: 'existing' });

    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({
      circuitState: 'OPEN',
      nextRetryAt: new Date(Date.now() - 1_000),
      failureCount: 5,
    });
    deps.roadmap.operation.getByIdempotency.mockResolvedValueOnce(null);
    const created = await service.operation('actor-1', 'integration-1', {
      operationKey: 'sync',
      direction: 'OUTBOUND',
      idempotencyKey: 'key-2',
      maxAttempts: 20,
      requestPayload: { x: 1 },
    });
    expect(created).toMatchObject({ state: 'RUNNING', maxAttempts: 10 });

    deps.roadmap.runtime.getOrCreate.mockResolvedValueOnce({
      failureCount: 1,
      circuitState: 'CLOSED',
      openedAt: null,
    });
    const failed = await service.failOperation('actor-1', 'operation-1', {
      code: 'TEMP',
      message: 'temporary',
      retryable: true,
    });
    expect(failed.operation.state).toBe('RETRY_SCHEDULED');
    expect(failed.runtime.failureCount).toBe(2);
  });
});
