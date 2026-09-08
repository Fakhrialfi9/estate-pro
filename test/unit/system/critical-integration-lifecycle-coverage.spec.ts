import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { IntegrationProviderPort } from '../../../src/modules/system/domain/integration/integration.contracts.js';
import { SystemIntegrationCallbackService } from '../../../src/modules/system/application/services/system-integration-callback.service.js';
import {
  DEFAULT_INTEGRATION_RETRY_POLICY,
  SystemIntegrationReliabilityService,
} from '../../../src/modules/system/application/services/system-integration-reliability.service.js';
import { SystemIntegrationSyncService } from '../../../src/modules/system/application/services/system-integration-sync.service.js';

const uuid = '11111111-1111-4111-8111-111111111111';

const makeProvider = (): IntegrationProviderPort => ({
  key: 'crm',
  version: '1.0',
  capabilities: ['SYNC'],
  testConnection: vi.fn().mockResolvedValue({ ok: true }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  verifySignature: vi.fn().mockResolvedValue(true),
  normalizeInbound: vi.fn().mockReturnValue({
    eventKey: 'evt-1',
    eventName: 'lead.updated',
    eventVersion: 1,
    occurredAt: new Date(),
    aggregateType: 'lead',
    aggregateUuid: uuid,
    payload: { name: 'Jane' },
  }),
  health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 10 }),
});

describe('integration callback lifecycle', () => {
  it('accepts verified callbacks and handles replay/error branches', async () => {
    const provider = makeProvider();
    const integrations = {
      get: vi.fn().mockResolvedValue({
        id: 1n,
        uuid,
        state: 'ACTIVE',
        secretRef: 'vault://secret',
      }),
    };
    const roadmap = {
      idempotency: {
        reserve: vi.fn().mockResolvedValue({
          created: true,
          record: {
            uuid: 'id-1',
            status: 'PROCESSING',
            attempt: 0,
            payloadHash: 'x',
          },
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
    const service = new SystemIntegrationCallbackService(
      integrations as never,
      roadmap as never,
    );
    const input = {
      timestamp: new Date().toISOString(),
      signature: 'sig',
      body: '{"id":1}',
    };

    await expect(service.enqueue(uuid, input, provider)).resolves.toMatchObject(
      { status: 'ACCEPTED' },
    );

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: false,
      record: {
        uuid: 'id-1',
        status: 'PROCESSED',
        attempt: 1,
        payloadHash: 'same',
      },
    });
    await expect(service.enqueue(uuid, input, provider)).resolves.toMatchObject(
      { status: 'DUPLICATE' },
    );

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: false,
      record: {
        uuid: 'id-1',
        status: 'PROCESSING',
        attempt: 1,
        payloadHash: 'same',
      },
    });
    await expect(service.enqueue(uuid, input, provider)).resolves.toMatchObject(
      { status: 'ALREADY_QUEUED' },
    );

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: false,
      record: {
        uuid: 'id-1',
        status: 'PROCESSING',
        attempt: 1,
        payloadHash: 'different',
      },
    });
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    integrations.get.mockResolvedValueOnce(null);
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    integrations.get.mockResolvedValueOnce({
      id: 1n,
      uuid,
      state: 'DISABLED',
      secretRef: null,
    });
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    integrations.get.mockResolvedValue({
      id: 1n,
      uuid,
      state: 'ACTIVE',
      secretRef: 'vault://secret',
    });

    await expect(
      service.enqueue(
        uuid,
        { ...input, timestamp: new Date(Date.now() - 600_001).toISOString() },
        provider,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.enqueue(uuid, input, { ...provider, verifySignature: undefined }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    provider.verifySignature = vi
      .fn<NonNullable<IntegrationProviderPort['verifySignature']>>()
      .mockRejectedValueOnce(new Error('invalid'));
    await expect(
      service.enqueue(uuid, input, provider),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    provider.verifySignature = vi
      .fn<NonNullable<IntegrationProviderPort['verifySignature']>>()
      .mockResolvedValue(true);

    await expect(
      service.enqueue(uuid, input, {
        ...provider,
        normalizeInbound: undefined,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.enqueue(uuid, { ...input, body: '{invalid' }, provider),
    ).rejects.toBeInstanceOf(BadRequestException);

    roadmap.event.getByKey.mockResolvedValueOnce({
      uuid: 'existing',
      status: 'PROCESSED',
      processedAt: new Date(),
    });
    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: true,
      record: {
        uuid: 'id-2',
        status: 'PROCESSING',
        attempt: 0,
        payloadHash: 'x',
      },
    });
    await expect(service.enqueue(uuid, input, provider)).resolves.toMatchObject(
      { status: 'DUPLICATE', eventUuid: 'existing' },
    );

    roadmap.event.getByKey.mockResolvedValueOnce(null);
    roadmap.event.create.mockRejectedValueOnce(new Error('queue failed'));
    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: true,
      record: {
        uuid: 'id-3',
        status: 'PROCESSING',
        attempt: 0,
        payloadHash: 'x',
      },
    });
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(service.processQueuedEvent(1n, 'missing')).resolves.toBeNull();
  });
});

describe('integration reliability', () => {
  it('covers retry classification, backoff, circuit and health outcomes', async () => {
    const provider = makeProvider();
    const integrations = {
      providerFor: vi.fn().mockResolvedValue(provider),
      runtimeFor: vi.fn().mockResolvedValue({
        integrationId: 1n,
        circuitState: 'CLOSED',
        nextRetryAt: null,
        openedAt: null,
        successCount: 0,
        failureCount: 0,
      }),
      providerConfiguration: vi
        .fn()
        .mockResolvedValue({ metadata: {}, secretRef: null }),
    };
    const roadmap = {
      runtime: { update: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new SystemIntegrationReliabilityService(
      integrations as never,
      roadmap as never,
    );

    expect(service.isRetryable('text')).toBe(true);
    expect(service.isRetryable(new Error('401 unauthorized'))).toBe(false);
    expect(service.isRetryable(new Error('timeout'))).toBe(true);
    expect(service.retryAfterMs({ retryAfterMs: 99_999 })).toBe(60_000);
    expect(service.retryAfterMs({ retryAfterMs: 'x' })).toBeNull();
    expect(service.delayMs(0, DEFAULT_INTEGRATION_RETRY_POLICY, 0)).toBe(200);
    await expect(
      service.execute(uuid, () => Promise.resolve('ok'), {
        ...DEFAULT_INTEGRATION_RETRY_POLICY,
        maxAttempts: 0,
      }),
    ).rejects.toThrow('maxAttempts');
    await expect(
      service.execute(uuid, () => Promise.resolve('ok')),
    ).resolves.toMatchObject({ value: 'ok', retry: { attempt: 1 } });

    integrations.runtimeFor.mockResolvedValueOnce({
      integrationId: 1n,
      circuitState: 'OPEN',
      nextRetryAt: new Date(Date.now() + 60_000),
      openedAt: null,
      successCount: 0,
      failureCount: 0,
    });
    await expect(
      service.execute(uuid, () => Promise.resolve('no')),
    ).rejects.toThrow('circuit breaker is open');

    provider.health = vi
      .fn<NonNullable<IntegrationProviderPort['health']>>()
      .mockResolvedValue({ ok: true, latencyMs: 10 });
    await expect(service.providerHealth(uuid)).resolves.toMatchObject({
      status: 'UP',
    });
    provider.health = vi
      .fn<NonNullable<IntegrationProviderPort['health']>>()
      .mockResolvedValue({ ok: true, latencyMs: 1_500 });
    await expect(service.providerHealth(uuid)).resolves.toMatchObject({
      status: 'DEGRADED',
    });
    provider.health = vi
      .fn<NonNullable<IntegrationProviderPort['health']>>()
      .mockResolvedValue({ ok: false, latencyMs: 10 });
    await expect(service.providerHealth(uuid)).resolves.toMatchObject({
      status: 'DOWN',
    });
    provider.health = vi
      .fn<NonNullable<IntegrationProviderPort['health']>>()
      .mockRejectedValueOnce(new Error('timeout'));
    await expect(service.providerHealth(uuid)).resolves.toMatchObject({
      status: 'UNKNOWN',
    });

    integrations.providerFor.mockResolvedValue({
      ...provider,
      health: undefined,
    });
    await expect(service.providerHealth(uuid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('integration sync', () => {
  it('covers module lifecycle, push/pull/bidirectional and retry lookup', async () => {
    const provider = makeProvider();
    const integrations = {
      providerFor: vi.fn().mockResolvedValue({
        ...provider,
        push: vi.fn().mockResolvedValue({
          ok: true,
          operationKey: 'sync.push',
          data: {},
          errorCode: null,
          errorMessage: null,
          providerRequestId: null,
          receivedAt: new Date(),
        }),
        pull: vi
          .fn()
          .mockResolvedValue({ records: [{ remote: 1 }], nextCursor: 'c2' }),
      }),
      runtimeFor: vi.fn().mockResolvedValue({
        integrationId: 1n,
        circuitState: 'CLOSED',
        nextRetryAt: null,
        successCount: 0,
        failureCount: 0,
        requestMapping: {},
        responseMapping: {},
        syncCursor: null,
      }),
      providerConfiguration: vi
        .fn()
        .mockResolvedValue({ metadata: {}, secretRef: null }),
      list: vi.fn().mockResolvedValue({ items: [{ uuid }] }),
      get: vi.fn().mockResolvedValue({ id: 1n, uuid, state: 'ACTIVE' }),
    };
    const reliability = {
      execute: vi
        .fn()
        .mockImplementation(
          async (_uuid: string, operation: () => Promise<unknown>) => ({
            value: await operation(),
            retry: { attempt: 1 },
          }),
        ),
      isRetryable: vi.fn().mockReturnValue(true),
      delayMs: vi.fn().mockReturnValue(10),
    };
    const mapping = {
      validate: vi.fn(),
      map: vi.fn((value: Record<string, unknown>) => value),
    };
    const roadmap = {
      operation: {
        getByIdempotency: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          uuid: 'operation-1',
          attempt: 1,
          maxAttempts: 5,
          state: 'RUNNING',
        }),
        update: vi.fn().mockResolvedValue({
          uuid: 'operation-1',
          attempt: 1,
          maxAttempts: 5,
          state: 'RUNNING',
        }),
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
      retryRepository,
      audit,
    );

    service.onModuleInit();
    service.onModuleDestroy();
    await expect(
      service.push('actor', uuid, {
        resourceType: 'lead',
        payload: { name: 'Jane' },
        idempotencyKey: 'key',
      }),
    ).resolves.toMatchObject({ direction: 'PUSH' });
    roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      uuid: 'done',
      state: 'SUCCEEDED',
      responsePayload: { ok: true },
      attempt: 1,
      maxAttempts: 5,
    });
    await expect(
      service.push('actor', uuid, {
        resourceType: 'lead',
        payload: {},
        idempotencyKey: 'done',
      }),
    ).resolves.toMatchObject({ idempotentReplay: true });
    roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      uuid: 'running',
      state: 'RUNNING',
      attempt: 1,
      maxAttempts: 5,
    });
    await expect(
      service.push('actor', uuid, {
        resourceType: 'lead',
        payload: {},
        idempotencyKey: 'running',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    integrations.providerFor.mockResolvedValueOnce({
      ...provider,
      push: undefined,
    });
    await expect(
      service.push('actor', uuid, {
        resourceType: 'lead',
        payload: {},
        idempotencyKey: 'missing',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    roadmap.operation.getByIdempotency.mockResolvedValue(null);
    integrations.providerFor.mockResolvedValue({
      ...provider,
      pull: vi
        .fn()
        .mockResolvedValue({ records: [{ remote: 1 }], nextCursor: 'next' }),
      push: vi.fn().mockResolvedValue({
        ok: true,
        operationKey: 'sync.push',
        data: {},
        errorCode: null,
        errorMessage: null,
        providerRequestId: null,
        receivedAt: new Date(),
      }),
    });
    await expect(
      service.pull('actor', uuid, { resourceType: 'lead' }),
    ).resolves.toMatchObject({ direction: 'PULL', recordsRead: 1 });
    integrations.providerFor.mockResolvedValueOnce({
      ...provider,
      pull: undefined,
    });
    await expect(
      service.pull('actor', uuid, { resourceType: 'lead' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.bidirectional('actor', uuid, { resourceType: 'lead' }),
    ).resolves.toMatchObject({ direction: 'BIDIRECTIONAL' });
    await expect(
      service.operationIdempotency(uuid, 'key'),
    ).resolves.toHaveLength(64);
    roadmap.operation.list.mockResolvedValueOnce([
      { uuid: 'op-1', state: 'FAILED', attempt: 1, maxAttempts: 2 },
    ]);
    await expect(
      service.retryOperation('actor', 'op-1'),
    ).resolves.toMatchObject({ uuid: 'operation-1' });
    roadmap.operation.list.mockResolvedValueOnce([
      { uuid: 'op-2', state: 'SUCCEEDED', attempt: 1, maxAttempts: 2 },
    ]);
    await expect(
      service.retryOperation('actor', 'op-2'),
    ).rejects.toBeInstanceOf(ConflictException);
    roadmap.operation.list.mockResolvedValueOnce([]);
    await expect(
      service.retryOperation('actor', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
