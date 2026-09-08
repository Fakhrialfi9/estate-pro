import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SystemIntegrationCallbackService } from '../../../src/modules/system/application/services/system-integration-callback.service.js';
import {
  DEFAULT_INTEGRATION_RETRY_POLICY,
  SystemIntegrationReliabilityService,
} from '../../../src/modules/system/application/services/system-integration-reliability.service.js';
import { SystemIntegrationSyncService } from '../../../src/modules/system/application/services/system-integration-sync.service.js';
import type { IntegrationProviderPort } from '../../../src/modules/system/domain/integration/integration.contracts.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const integration = {
  id: 1n,
  uuid,
  state: 'ACTIVE',
  secretRef: 'vault://secret',
};

const runtime = {
  integrationId: 1n,
  circuitState: 'CLOSED',
  nextRetryAt: null,
  openedAt: null,
  successCount: 0,
  failureCount: 0,
  requestMapping: {},
  responseMapping: {},
  syncCursor: null,
};

const provider: IntegrationProviderPort = {
  key: 'crm',
  version: '1.0',
  capabilities: ['TEST', 'SYNC'],
  verifySignature: vi.fn().mockResolvedValue(true),
  normalizeInbound: vi.fn().mockReturnValue({
    eventKey: 'evt-1',
    eventName: 'lead.updated',
    eventVersion: '1',
    occurredAt: new Date(),
    aggregateType: 'lead',
    aggregateUuid: uuid,
    payload: { name: 'Jane' },
  }),
};

describe('critical integration lifecycle coverage', () => {
  it('covers callback signature, replay, idempotency and queue lifecycle', async () => {
    const integrations = { get: vi.fn().mockResolvedValue(integration) };
    const roadmap = {
      idempotency: {
        reserve: vi.fn().mockResolvedValue({
          created: true,
          record: { uuid: 'idem-1', status: 'PROCESSING', attempt: 0, payloadHash: 'hash' },
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      event: {
        getByKey: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ uuid: 'event-1' }),
        list: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const service = new SystemIntegrationCallbackService(integrations as never, roadmap as never);
    const input = {
      timestamp: new Date().toISOString(),
      signature: 'sig',
      body: JSON.stringify({ id: 1 }),
    };

    await expect(service.handle(uuid, input, provider)).resolves.toMatchObject({
      status: 'ACCEPTED',
      eventKey: 'evt-1',
      eventUuid: 'event-1',
    });
    expect(roadmap.event.create).toHaveBeenCalledTimes(1);

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: false,
      record: { uuid: 'idem-1', status: 'PROCESSED', attempt: 1, payloadHash: 'hash' },
    });
    await expect(service.enqueue(uuid, input, provider)).resolves.toMatchObject({ status: 'DUPLICATE' });

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: false,
      record: { uuid: 'idem-1', status: 'PROCESSING', attempt: 1, payloadHash: 'hash' },
    });
    await expect(service.enqueue(uuid, input, provider)).resolves.toMatchObject({ status: 'ALREADY_QUEUED' });

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: false,
      record: { uuid: 'idem-1', status: 'PROCESSING', attempt: 1, payloadHash: 'different' },
    });
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(UnauthorizedException);

    integrations.get.mockResolvedValueOnce(null);
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(BadRequestException);
    integrations.get.mockResolvedValueOnce({ ...integration, state: 'DISABLED' });
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(UnauthorizedException);
    integrations.get.mockResolvedValue(integration);

    await expect(
      service.enqueue(uuid, { ...input, timestamp: new Date(Date.now() - 600_001).toISOString() }, provider),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.enqueue(uuid, input, { ...provider, verifySignature: undefined }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    (provider.verifySignature as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('bad signature'));
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(UnauthorizedException);
    (provider.verifySignature as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await expect(
      service.enqueue(uuid, input, { ...provider, normalizeInbound: undefined }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.enqueue(uuid, { ...input, body: '{invalid' }, provider),
    ).rejects.toBeInstanceOf(BadRequestException);

    (provider.normalizeInbound as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      eventKey: '',
      eventName: 'x',
      eventVersion: '1',
      occurredAt: new Date(),
      aggregateType: 'lead',
      aggregateUuid: uuid,
      payload: {},
    });
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(BadRequestException);

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: true,
      record: { uuid: 'idem-2', status: 'PROCESSING', attempt: 0, payloadHash: 'x' },
    });
    roadmap.event.getByKey.mockResolvedValueOnce({ uuid: 'event-existing', status: 'PROCESSED', processedAt: new Date() });
    await expect(service.enqueue(uuid, input, provider)).resolves.toMatchObject({ status: 'DUPLICATE', eventUuid: 'event-existing' });

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: true,
      record: { uuid: 'idem-3', status: 'PROCESSING', attempt: 0, payloadHash: 'x' },
    });
    roadmap.event.getByKey.mockResolvedValueOnce(null);
    roadmap.event.create.mockRejectedValueOnce(new Error('queue failure'));
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(BadRequestException);
    expect(roadmap.idempotency.update).toHaveBeenCalled();

    roadmap.event.list.mockResolvedValueOnce([]);
    await expect(service.processQueuedEvent(1n, 'missing')).resolves.toBeNull();
    const queued = {
      uuid: 'event-2',
      eventKey: 'evt-2',
      eventName: 'lead.updated',
      eventVersion: '1',
      payloadHash: 'hash-2',
      status: 'RECEIVED',
      processedAt: null,
    };
    roadmap.event.list.mockResolvedValueOnce([queued]);
    roadmap.idempotency.reserve.mockResolvedValueOnce({ created: true, record: { uuid: 'idem-event', status: 'PROCESSED', attempt: 1 } });
    await expect(service.processQueuedEvent(1n, 'event-2')).resolves.toEqual(queued);
    roadmap.event.list.mockResolvedValueOnce([queued]);
    roadmap.idempotency.reserve.mockResolvedValueOnce({ created: false, record: { uuid: 'idem-event', status: 'PROCESSING' } });
    await expect(service.processQueuedEvent(1n, 'event-2')).resolves.toEqual(queued);
  });

  it('covers reliability classification, retry delays, circuit state and health', async () => {
    const integrations = {
      providerFor: vi.fn().mockResolvedValue(provider),
      runtimeFor: vi.fn().mockResolvedValue(runtime),
      providerConfiguration: vi.fn().mockResolvedValue({ metadata: {}, secretRef: null }),
    };
    const roadmap = {
      runtime: { update: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new SystemIntegrationReliabilityService(integrations as never, roadmap as never);

    expect(service.isRetryable('plain')).toBe(true);
    expect(service.isRetryable(new Error('401 unauthorized'))).toBe(false);
    expect(service.isRetryable(new Error('timeout'))).toBe(true);
    expect(service.isRetryable(new Error('unsupported feature'))).toBe(false);
    expect(service.retryAfterMs({ retryAfterMs: 123456 })).toBe(60000);
    expect(service.retryAfterMs({ retryAfterMs: 12.8 })).toBe(12);
    expect(service.retryAfterMs({ retryAfterMs: '12' })).toBeNull();
    expect(service.retryAfterMs(null)).toBeNull();
    expect(service.delayMs(0, DEFAULT_INTEGRATION_RETRY_POLICY, 0)).toBe(200);
    expect(service.delayMs(2, { ...DEFAULT_INTEGRATION_RETRY_POLICY, jitterRatio: 2 }, 1)).toBe(5000);
    await expect(
      service.execute(uuid, async () => 'ok', { ...DEFAULT_INTEGRATION_RETRY_POLICY, maxAttempts: 0 }),
    ).rejects.toThrow('maxAttempts');

    await expect(service.execute(uuid, async () => 'ok')).resolves.toMatchObject({
      value: 'ok',
      retry: { attempt: 1, retryable: false },
    });
    const error = new Error('timeout');
    integrations.runtimeFor.mockResolvedValue({ ...runtime, circuitState: 'OPEN', nextRetryAt: new Date(Date.now() + 60_000) });
    await expect(service.execute(uuid, async () => 'no')).rejects.toThrow('circuit breaker is open');

    integrations.runtimeFor.mockResolvedValue({ ...runtime, circuitState: 'OPEN', nextRetryAt: new Date(Date.now() - 1) });
    const closedPolicy = { ...DEFAULT_INTEGRATION_RETRY_POLICY, maxAttempts: 2, circuitFailureThreshold: 1, deadlineMs: 500 };
    await expect(
      service.execute(uuid, async () => {
        throw error;
      }, closedPolicy),
    ).rejects.toThrow('timeout');

    integrations.runtimeFor.mockResolvedValue(runtime);
    const healthProvider = {
      ...provider,
      health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 10 }),
    };
    integrations.providerFor.mockResolvedValue(healthProvider);
    await expect(service.providerHealth(uuid)).resolves.toMatchObject({ status: 'UP', latencyMs: 10 });
    healthProvider.health.mockResolvedValueOnce({ ok: true, latencyMs: 1500 });
    await expect(service.providerHealth(uuid)).resolves.toMatchObject({ status: 'DEGRADED' });
    healthProvider.health.mockResolvedValueOnce({ ok: false, latencyMs: 10 });
    await expect(service.providerHealth(uuid)).resolves.toMatchObject({ status: 'DOWN' });
    healthProvider.health.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.providerHealth(uuid)).resolves.toMatchObject({ status: 'UNKNOWN', code: 'HEALTH_TIMEOUT' });
    integrations.providerFor.mockResolvedValue({ ...provider, health: undefined });
    await expect(service.providerHealth(uuid)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('covers sync push, pull, bidirectional, idempotency and retry decisions', async () => {
    const mapping = {
      validate: vi.fn(),
      map: vi.fn((value: Record<string, unknown>) => value),
    };
    const reliability = {
      execute: vi.fn().mockImplementation(async (_integration: string, operation: () => Promise<unknown>) => ({
        value: await operation(provider),
        retry: { attempt: 1 },
      })),
      isRetryable: vi.fn().mockReturnValue(true),
      delayMs: vi.fn().mockReturnValue(10),
    };
    const integrations = {
      providerFor: vi.fn().mockResolvedValue({
        ...provider,
        push: vi.fn().mockResolvedValue({ ok: true, data: { remote: 1 } }),
        pull: vi.fn().mockResolvedValue({ records: [{ remote: 1 }], nextCursor: 'c2' }),
      }),
      runtimeFor: vi.fn().mockResolvedValue(runtime),
      providerConfiguration: vi.fn().mockResolvedValue({ metadata: {}, secretRef: null }),
      list: vi.fn().mockResolvedValue({ items: [{ uuid }] }),
      get: vi.fn().mockResolvedValue(integration),
    };
    const roadmap = {
      operation: {
        getByIdempotency: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ uuid: 'operation-1', attempt: 1, maxAttempts: 5, state: 'RUNNING' }),
        update: vi.fn().mockResolvedValue({ uuid: 'operation-1', attempt: 2, maxAttempts: 5, state: 'RUNNING' }),
        list: vi.fn().mockResolvedValue([]),
      },
      runtime: { update: vi.fn().mockResolvedValue(undefined) },
    };
    const retryRepository = { claimDue: vi.fn().mockResolvedValue([]) };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new SystemIntegrationSyncService(
      integrations as never,
      reliability as never,
      mapping as never,
      roadmap as never,
      retryRepository as never,
      audit as never,
    );

    service.onModuleInit();
    service.onModuleDestroy();

    await expect(service.push('actor', uuid, {
      resourceType: 'lead',
      payload: { name: 'Jane' },
      idempotencyKey: 'push-1',
    })).resolves.toMatchObject({ direction: 'PUSH', idempotentReplay: false });

    roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      uuid: 'done', state: 'SUCCEEDED', responsePayload: { ok: true }, attempt: 2, maxAttempts: 5,
    });
    await expect(service.push('actor', uuid, {
      resourceType: 'lead', payload: {}, idempotencyKey: 'push-done',
    })).resolves.toMatchObject({ idempotentReplay: true });

    roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      uuid: 'running', state: 'RUNNING', attempt: 1, maxAttempts: 5,
    });
    await expect(service.push('actor', uuid, { resourceType: 'lead', payload: {}, idempotencyKey: 'running' })).rejects.toBeInstanceOf(ConflictException);

    roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      uuid: 'retry', state: 'RETRY_SCHEDULED', nextAttemptAt: new Date(), attempt: 1, maxAttempts: 5,
    });
    await expect(service.push('actor', uuid, { resourceType: 'lead', payload: {}, idempotencyKey: 'retry' })).resolves.toMatchObject({ queued: true });

    roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      uuid: 'exhausted', state: 'FAILED', attempt: 5, maxAttempts: 5,
    });
    await expect(service.push('actor', uuid, { resourceType: 'lead', payload: {}, idempotencyKey: 'exhausted' })).rejects.toBeInstanceOf(ConflictException);

    const noPush = { ...provider, push: undefined };
    integrations.providerFor.mockResolvedValueOnce(noPush);
    await expect(service.push('actor', uuid, { resourceType: 'lead', payload: {}, idempotencyKey: 'no-push' })).rejects.toBeInstanceOf(BadRequestException);

    roadmap.operation.getByIdempotency.mockResolvedValue(null);
    integrations.providerFor.mockResolvedValue({
      ...provider,
      push: vi.fn().mockResolvedValue({ ok: true, data: { remote: 1 } }),
      pull: vi.fn().mockResolvedValue({ records: [{ remote: 1 }], nextCursor: 'c2' }),
    });
    await expect(service.pull('actor', uuid, { resourceType: 'lead' })).resolves.toMatchObject({ direction: 'PULL', recordsRead: 1 });
    roadmap.operation.getByIdempotency.mockResolvedValueOnce({ uuid: 'pull-done', state: 'SUCCEEDED', attempt: 1, maxAttempts: 5, responsePayload: { records: [{ id: 1 }], nextCursor: 'c9' } });
    await expect(service.pull('actor', uuid, { resourceType: 'lead' })).resolves.toMatchObject({ idempotentReplay: true, recordsRead: 1 });
    const noPull = { ...provider, pull: undefined };
    integrations.providerFor.mockResolvedValueOnce(noPull);
    await expect(service.pull('actor', uuid, { resourceType: 'lead' })).rejects.toBeInstanceOf(BadRequestException);

    integrations.providerFor.mockResolvedValue({
      ...provider,
      push: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      pull: vi.fn().mockResolvedValue({ records: [], nextCursor: null }),
    });
    roadmap.operation.getByIdempotency.mockResolvedValue(null);
    await expect(service.bidirectional('actor', uuid, { resourceType: 'lead' })).resolves.toMatchObject({ direction: 'BIDIRECTIONAL', push: null });
    await expect(service.operationIdempotency(uuid, 'key')).resolves.toHaveLength(64);
    roadmap.operation.list.mockResolvedValueOnce([{ uuid: 'op-1', state: 'FAILED', attempt: 1, maxAttempts: 2 }]);
    await expect(service.retryOperation('actor', 'op-1')).resolves.toMatchObject({ uuid: 'operation-1' });
    roadmap.operation.list.mockResolvedValueOnce([{ uuid: 'op-2', state: 'SUCCEEDED', attempt: 1, maxAttempts: 2 }]);
    await expect(service.retryOperation('actor', 'op-2')).rejects.toBeInstanceOf(ConflictException);
    roadmap.operation.list.mockResolvedValueOnce([]);
    await expect(service.retryOperation('actor', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
