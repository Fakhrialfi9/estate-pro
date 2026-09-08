import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';

import { SystemReadOnlyGuard } from '../../../src/modules/system/application/guards/system-read-only.guard.js';
import { SystemContentSafetyService } from '../../../src/modules/system/application/services/system-content-safety.service.js';
import { SystemEnvironmentService } from '../../../src/modules/system/application/services/system-environment.service.js';
import { SystemIntegrationCredentialService } from '../../../src/modules/system/application/services/system-integration-credential.service.js';
import { SystemIntegrationLogService } from '../../../src/modules/system/application/services/system-integration-log.service.js';
import { SystemIntegrationMappingService } from '../../../src/modules/system/application/services/system-integration-mapping.service.js';
import { SystemJobOperationsService } from '../../../src/modules/system/application/services/system-job-operations.service.js';
import { SystemOperationalAlertService } from '../../../src/modules/system/application/services/system-operational-alert.service.js';
import { SystemProductionHardeningService } from '../../../src/modules/system/application/services/system-production-hardening.service.js';
import { SystemWebhookRateLimitService } from '../../../src/modules/system/application/services/system-webhook-rate-limit.service.js';
import type { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';
import type { SystemIntegrationReliabilityService } from '../../../src/modules/system/application/services/system-integration-reliability.service.js';
import type { SystemIntegrationService } from '../../../src/modules/system/application/services/system-integration.service.js';
import type { SystemRoadmapRepository } from '../../../src/modules/system/domain/repositories/system-roadmap.repository.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';
import type { AutomationNotificationPort, AutomationSystemPort } from '../../../src/common/contracts/automation-system.port.js';
import type { IntegrationProviderPort } from '../../../src/modules/system/domain/integration/integration.contracts.js';
import type { SystemWebhookRateLimitRepository } from '../../../src/modules/system/domain/webhook/webhook-rate-limit.repository.js';

const uuid = '11111111-1111-4111-8111-111111111111';

const asConfig = (values: Record<string, unknown>): ConfigService =>
  ({
    get: vi.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService);

describe('critical system roadmap coverage', () => {
  it('covers read-only security matrix', async () => {
    const state = { maintenanceMode: false, readOnlyMode: false };
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const operations = { state: vi.fn().mockResolvedValue(state) };
    const guard = new SystemReadOnlyGuard(reflector, operations as never);

    const context = (request: Record<string, unknown>) =>
      ({
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => ({}),
        getClass: () => ({}),
      }) as never;

    await expect(guard.canActivate(context({ method: 'GET' }))).resolves.toBe(true);
    await expect(guard.canActivate(context({ method: 'POST' }))).resolves.toBe(true);
    await expect(
      guard.canActivate(context({ method: 'POST', path: '/api/v1/auth/login' })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(context({ method: 'POST', route: { path: '/api/v1/health/live' } })),
    ).resolves.toBe(true);

    reflector.getAllAndOverride = vi.fn().mockReturnValue(true);
    await expect(guard.canActivate(context({ method: 'DELETE' }))).resolves.toBe(true);

    reflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    state.readOnlyMode = true;
    await expect(guard.canActivate(context({ method: 'PATCH', path: '/api/v1/property' }))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    state.readOnlyMode = false;
    state.maintenanceMode = true;
    await expect(guard.canActivate(context({ method: 'PUT', originalUrl: '/api/v1/property' }))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('covers import content safety and export formula sanitization', () => {
    const service = new SystemContentSafetyService();

    expect(() => service.inspectImport(Buffer.from(''), 'csv')).toThrow('Import content is empty');
    expect(() => service.inspectImport(Buffer.from([0]), 'csv')).toThrow('Binary content is not allowed');
    expect(() => service.inspectImport(Buffer.from('bad\uFFFDtext'), 'json')).toThrow('invalid UTF-8');
    expect(() => service.inspectImport(Buffer.from('a'.repeat(50_001)), 'csv')).toThrow('CSV row exceeds');
    expect(() => service.inspectImport(Buffer.from('{"ok":true}'), 'json')).not.toThrow();
    expect(() => service.inspectImport(Buffer.from('a,b\n1,2'), 'csv')).not.toThrow();
    expect(service.sanitizeExportCell(' =SUM(A1)')).toBe("' =SUM(A1)");
    expect(service.sanitizeExportCell('safe')).toBe('safe');
  });

  it('covers environment defaults, overrides and process metadata', () => {
    const defaultService = new SystemEnvironmentService(asConfig({}));
    const defaults = defaultService.read();
    expect(defaults.environment).toBe('development');
    expect(defaults.application).toBe('estate-pro-api');
    expect(defaults.version).toBe('0.0.0');
    expect(defaults.deploymentId).toBeNull();
    expect(defaults.buildSha).toBeNull();
    expect(defaults.region).toBeNull();

    const configured = new SystemEnvironmentService(
      asConfig({
        'app.environment': 'production',
        'app.name': 'Estate Pro',
        'app.version': '1.2.3',
        'app.deploymentId': 'deploy-1',
        'app.buildSha': 'abc123',
        'app.region': 'id-jkt',
      }),
    );
    expect(configured.read()).toMatchObject({
      environment: 'production',
      application: 'Estate Pro',
      version: '1.2.3',
      deploymentId: 'deploy-1',
      buildSha: 'abc123',
      region: 'id-jkt',
    });
  });

  it('covers integration mapping transforms, defaults, nested paths and rejection', () => {
    const service = new SystemIntegrationMappingService();
    const result = service.map(
      {
        name: 'Jane',
        amount: '125',
        active: 'true',
        nested: { value: '2026-01-01T00:00:00.000Z' },
        items: [{ value: 'first' }],
      },
      {
        fields: {
          customerName: 'name',
          price: { from: 'amount', transform: 'number' },
          enabled: { from: 'active', transform: 'boolean' },
          createdAt: { from: 'nested.value', transform: 'date' },
          missing: { from: 'unknown', default: 'fallback' },
          nullable: { default: null, omitIfNull: true },
          itemValue: 'items.0.value',
        },
      },
    );

    expect(result).toMatchObject({
      customerName: 'Jane',
      price: 125,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      missing: 'fallback',
      itemValue: 'first',
    });
    expect(result).not.toHaveProperty('nullable');
    expect(service.map({ value: 1 }, {})).toEqual({ value: 1 });
    expect(() => service.map({}, { value: { from: 'value', transform: 'number' } })).not.toThrow();
    expect(() => service.map({}, { '__proto__.polluted': 'value' })).toThrow('Invalid integration mapping path');
    expect(() => service.validate({ providerVersion: '1' }, '2')).toThrow('provider version mismatch');
    expect(() => service.validate({ value: { transform: 'invalid' } })).toThrow('Unsupported integration mapping transform');
    expect(() => service.map({ value: 'bad' }, { value: { from: 'value', transform: 'number' } })).toThrow('invalid number');
    expect(() => service.map({ value: 'maybe' }, { value: { from: 'value', transform: 'boolean' } })).toThrow('invalid boolean');
    expect(() => service.map({ value: 'bad-date' }, { value: { from: 'value', transform: 'date' } })).toThrow('invalid date');
  });

  it('covers credential refresh, redaction and secure failure paths', async () => {
    const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as SecurityAuditRepository;
    const credential = {
      uuid,
      status: 'ACTIVE',
      secretRef: 'vault://client',
      accessTokenRef: 'vault://access',
      refreshTokenRef: 'vault://refresh',
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      metadata: { provider: 'crm' },
    };
    const roadmap = {
      credential: {
        get: vi.fn().mockResolvedValue(credential),
        rotate: vi.fn().mockResolvedValue({ ...credential, uuid: 'rotated' }),
        markUsed: vi.fn().mockResolvedValue(undefined),
      },
    };
    const provider = {
      refreshAccessToken: vi.fn().mockResolvedValue({
        accessTokenReference: 'vault://access-2',
        refreshTokenReference: 'vault://refresh-2',
      }),
    };
    const service = new SystemIntegrationCredentialService(
      roadmap as never,
      audit,
    );

    await expect(service.get(uuid)).resolves.toMatchObject({
      secretRef: 'vault://***',
      accessTokenRef: 'vault://***',
      refreshTokenRef: 'vault://***',
    });
    await expect(service.refresh(uuid, uuid, provider as IntegrationProviderPort)).resolves.toMatchObject({
      uuid: 'rotated',
    });
    expect(roadmap.credential.rotate).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);

    roadmap.credential.get.mockResolvedValueOnce(null);
    await expect(service.get(uuid)).rejects.toThrow('Integration credential not found');

    roadmap.credential.get.mockResolvedValueOnce({ ...credential, status: 'REVOKED' });
    await expect(service.refresh(uuid, uuid, provider as IntegrationProviderPort)).rejects.toThrow('not active');
    roadmap.credential.get.mockResolvedValueOnce({ ...credential, refreshTokenRef: null });
    await expect(service.refresh(uuid, uuid, provider as IntegrationProviderPort)).rejects.toThrow('no refresh token');
    roadmap.credential.get.mockResolvedValueOnce({
      ...credential,
      accessTokenExpiresAt: new Date(Date.now() + 120_000),
    });
    await expect(service.refresh(uuid, uuid, provider as IntegrationProviderPort)).resolves.toMatchObject({
      accessTokenRef: 'vault://***',
    });
    roadmap.credential.get.mockResolvedValueOnce(credential);
    await expect(
      service.refresh(uuid, uuid, {} as IntegrationProviderPort),
    ).rejects.toThrow('does not support OAuth refresh');
    provider.refreshAccessToken.mockResolvedValueOnce({
      accessTokenReference: 'invalid',
      refreshTokenReference: 'vault://refresh-3',
    });
    await expect(service.refresh(uuid, uuid, provider as IntegrationProviderPort)).rejects.toThrow(
      'invalid access token reference',
    );
  });

  it('covers integration logs, limits, filtering and latency calculation', async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        uuid,
        integrationUuid: 'integration-1',
        providerKey: 'crm',
        operationKey: 'sync',
        direction: 'OUTBOUND',
        state: 'SUCCEEDED',
        attempt: 2,
        maxAttempts: 3,
        idempotencyKey: 'key',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        completedAt: new Date('2026-01-01T00:00:01Z'),
        nextAttemptAt: null,
        errorCode: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        uuid: 'second',
        integrationUuid: 'integration-1',
        providerKey: 'crm',
        operationKey: 'sync',
        direction: 'OUTBOUND',
        state: 'FAILED',
        attempt: 1,
        maxAttempts: 3,
        idempotencyKey: 'key-2',
        startedAt: null,
        completedAt: null,
        nextAttemptAt: null,
        errorCode: 'TIMEOUT',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const service = new SystemIntegrationLogService(prisma);

    await expect(
      service.list({ integrationUuid: uuid, state: 'FAILED', operationKey: 'sync', limit: 1 }),
    ).resolves.toMatchObject([
      { uuid, latencyMs: 1000 },
      { uuid: 'second', latencyMs: null },
    ]);
    await expect(service.list({ from: new Date('2026-01-02'), to: new Date('2026-01-01') })).rejects.toThrow(
      'Invalid integration log range',
    );
    await expect(
      service.list({ from: new Date('2025-01-01'), to: new Date('2026-01-01') }),
    ).rejects.toThrow('cannot exceed 90 days');
  });

  it('covers job operation delegation and rate limiting', async () => {
    const automation = {
      listExecutions: vi.fn().mockResolvedValue({ items: [] }),
      getExecution: vi.fn().mockResolvedValue({ uuid }),
      retryExecution: vi.fn().mockResolvedValue({ uuid, state: 'RETRYING' }),
      cancelExecution: vi.fn().mockResolvedValue({ uuid, state: 'CANCELLED' }),
    } as unknown as AutomationSystemPort;
    const jobs = new SystemJobOperationsService(automation);

    await expect(jobs.list({ page: 1, limit: 10, state: 'FAILED' }, uuid)).resolves.toEqual({ items: [] });
    await expect(jobs.get(uuid, uuid)).resolves.toEqual({ uuid });
    await expect(jobs.retry(uuid, uuid)).resolves.toMatchObject({ state: 'RETRYING' });
    await expect(jobs.cancel(uuid, uuid)).resolves.toMatchObject({ state: 'CANCELLED' });

    const consume = vi.fn().mockResolvedValue({ allowed: true });
    const repository = { consume } as unknown as SystemWebhookRateLimitRepository;
    const rateLimit = new SystemWebhookRateLimitService(
      repository,
      asConfig({ 'system.webhook.rateWindowMs': 500, 'system.webhook.rateLimit': 0 }),
    );
    await expect(rateLimit.consume(uuid)).resolves.toBeUndefined();
    expect(consume).toHaveBeenCalledWith(uuid, expect.any(Date), 1);

    consume.mockResolvedValueOnce({ allowed: false });
    await expect(rateLimit.consume(uuid)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('covers operational alert threshold, notification, acknowledgement and missing alert', async () => {
    const alert = {
      uuid: 'alert-1',
      alertKey: 'QUEUE_DEPTH',
      severity: 'CRITICAL',
      status: 'OPEN',
      message: 'QUEUE_DEPTH threshold exceeded',
      dedupeKey: 'QUEUE_DEPTH:global',
      resourceType: null,
      resourceUuid: null,
      metadata: { existing: true },
    };
    const roadmap = {
      alertRule: {
        list: vi.fn().mockResolvedValue([
          { ruleKey: 'QUEUE_DEPTH', signal: 'queue', threshold: 10, severity: 'CRITICAL', metadata: { targetUserUuid: uuid } },
          { ruleKey: 'CPU', signal: 'cpu', threshold: 90, severity: 'WARNING', metadata: {} },
        ]),
      },
      alert: {
        upsert: vi.fn().mockResolvedValue(alert),
        list: vi.fn().mockResolvedValue([alert]),
      },
    };
    const notifications = {
      createNotification: vi.fn().mockResolvedValue(undefined),
    } as unknown as AutomationNotificationPort;
    const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as SecurityAuditRepository;
    const service = new SystemOperationalAlertService(
      roadmap as never,
      notifications,
      audit,
    );

    await expect(service.evaluate({ signals: { queue: 20, cpu: 10 } })).resolves.toEqual([alert]);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userUuid: uuid, priority: 'URGENT' }),
    );
    await expect(service.acknowledge(uuid, 'alert-1')).resolves.toMatchObject({ status: 'ACKNOWLEDGED' });
    expect(audit.record).toHaveBeenCalledTimes(1);

    roadmap.alert.list.mockResolvedValueOnce([]);
    await expect(service.acknowledge(uuid, 'missing')).rejects.toThrow('Operational alert not found');
  });

  it('covers production hardening metrics, health, retry, cleanup and safe defaults', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          {
            bucket: '2026-01-01',
            state: 'SUCCEEDED',
            count: 2,
            retries: 1,
            failures: 0,
            averageLatencyMs: 10,
          },
          {
            bucket: '2026-01-01',
            state: null,
            count: 1n,
            retries: '2',
            failures: '1',
            averageLatencyMs: '20',
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      systemIntegrationOperation: {
        findMany: vi.fn().mockResolvedValue([
          { uuid, state: 'FAILED', attempt: 1, maxAttempts: 3, createdAt: new Date() },
          { uuid: 'maxed', state: 'FAILED', attempt: 3, maxAttempts: 3, createdAt: new Date() },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const integrations = {
      list: vi.fn().mockResolvedValue({
        items: [
          { uuid, providerKey: 'crm', state: 'ACTIVE' },
          { uuid: 'second', providerKey: 'mail', state: 'ACTIVE' },
        ],
      }),
    } as unknown as SystemIntegrationService;
    const reliability = {
      providerHealth: vi
        .fn()
        .mockResolvedValueOnce({ status: 'UP' })
        .mockResolvedValueOnce({ status: 'DOWN' }),
    } as unknown as SystemIntegrationReliabilityService;
    const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as SecurityAuditRepository;
    const service = new SystemProductionHardeningService(
      prisma,
      integrations,
      reliability,
      audit,
    );

    await expect(service.integrationMetrics()).resolves.toMatchObject({
      total: 3,
      failures: 1,
      errorRate: 1 / 3,
    });
    await expect(service.integrationMetrics(new Date('2026-01-01'), new Date('2026-01-02'), 'hour')).resolves.toMatchObject({
      granularity: 'hour',
    });
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.jobMetrics()).resolves.toMatchObject({ total: 0, errorRate: 0 });

    await expect(service.integrationHealth()).resolves.toMatchObject({ status: 'DOWN' });
    prisma.$queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    await expect(service.externalDependencyHealth()).resolves.toMatchObject({ status: 'DOWN' });

    await expect(service.retryFailedOperations({ dryRun: true }, uuid)).resolves.toMatchObject({ dryRun: true, count: 2 });
    await expect(service.retryFailedOperations({ dryRun: false, limit: 2 }, uuid)).resolves.toMatchObject({
      dryRun: false,
      count: 1,
      skippedMaxAttempts: 1,
    });
    expect(prisma.systemIntegrationOperation.update).toHaveBeenCalledTimes(1);

    expect(service.operationalCommands()).toMatchObject({
      safeDefaults: { dryRun: true, maxBatch: 25 },
    });
    prisma.systemIntegrationOperation.findMany.mockResolvedValueOnce([
      { uuid, createdAt: new Date('2025-01-01'), state: 'FAILED' },
    ]);
    await expect(service.orphanCleanup({ dryRun: true, olderThanHours: 24 }, uuid)).resolves.toMatchObject({ dryRun: true });
    prisma.systemIntegrationOperation.findMany.mockResolvedValueOnce([
      { uuid, createdAt: new Date('2025-01-01'), state: 'FAILED' },
    ]);
    await expect(service.orphanCleanup({ dryRun: false }, uuid)).resolves.toMatchObject({
      dryRun: false,
      deleted: 1,
    });
  });
});
