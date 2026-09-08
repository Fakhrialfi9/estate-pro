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
    const payloadHash =
      '037c9214eef74cc3887f3a4f085b4e17d76280dafd273b0ee160c09c4ba1cfd4';

    await expect(service.enqueue(uuid, input, provider)).resolves.toMatchObject(
      { status: 'ACCEPTED' },
    );

    roadmap.idempotency.reserve.mockResolvedValueOnce({
      created: false,
      record: {
        uuid: 'id-1',
        status: 'PROCESSED',
        attempt: 1,
        payloadHash,
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
        payloadHash,
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
      secretRef: 'vault://secret',
    });
    await expect(service.enqueue(uuid, input, provider)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('covers retry classification, backoff, circuit and health outcomes', async () => {
    const repo = {
      listPending: vi.fn().mockResolvedValue([]),
      markRetry: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const service = new SystemIntegrationReliabilityService(repo as never);
    expect(service.retryDelay(1)).toBe(DEFAULT_INTEGRATION_RETRY_POLICY.baseDelayMs);
    expect(service.retryDelay(100)).toBe(
      DEFAULT_INTEGRATION_RETRY_POLICY.maxDelayMs,
    );
    expect(service.shouldRetry({ code: 'TIMEOUT' }, 1)).toBe(true);
    expect(service.shouldRetry({ code: 'AUTH' }, 1)).toBe(false);
    await service.health();
  });

  it('covers module lifecycle, push/pull/bidirectional and retry lookup', async () => {
    const provider = makeProvider();
    const integrations = {
      listActive: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({
        id: 1n,
        uuid,
        state: 'ACTIVE',
        secretRef: 'vault://secret',
      }),
    };
    const repo = {
      listDue: vi.fn().mockResolvedValue([]),
      listActive: vi.fn().mockResolvedValue([]),
      recordSync: vi.fn().mockResolvedValue(undefined),
    };
    const sync = new SystemIntegrationSyncService(
      integrations as never,
      repo as never,
      provider,
    );
    await sync.onModuleInit();
    await sync.push(uuid);
    await sync.pull(uuid);
    await sync.bidirectional(uuid);
    await sync.retry('missing');
    await sync.onModuleDestroy();
  });
});
