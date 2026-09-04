import { describe, expect, it, vi } from 'vitest';

import { SystemWebhookService } from '../../../src/modules/system/application/services/system-webhook.service.js';
import type { SystemWebhookRepository } from '../../../src/modules/system/domain/repositories/system-webhook.repository.js';
import type {
  WebhookDeliveryRecord,
  WebhookSubscriptionRecord,
} from '../../../src/modules/system/domain/webhook/webhook.contracts.js';

type CreateDeliveryInput = Parameters<
  SystemWebhookRepository['createDelivery']
>[0];
type UpdateDeliveryInput = Parameters<
  SystemWebhookRepository['updateDelivery']
>[1];

const subscription = (
  filters: WebhookSubscriptionRecord['filters'] = [],
): WebhookSubscriptionRecord => ({
  id: 1n,
  uuid: 'sub-uuid',
  endpoint: 'https://example.test/webhook',
  status: 'ACTIVE',
  events: ['system.activity.created'],
  filters,
  secretCiphertext: 'ciphertext',
  secretVersion: 1,
  secretCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const delivery = (
  eventId: string,
  deliveryKey: string,
): WebhookDeliveryRecord => ({
  id: 1n,
  uuid: deliveryKey,
  subscriptionId: 1n,
  eventId,
  deliveryKey,
  eventName: 'system.activity.created',
  eventVersion: 1,
  payloadHash: 'hash'.padEnd(64, '0'),
  attemptCount: 1,
  state: 'SUCCEEDED',
  httpStatus: 200,
  responseSummary: 'HTTP 200',
  nextAttemptAt: null,
  signedAt: new Date(),
  completedAt: new Date(),
  failureReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createService = (rows: readonly WebhookSubscriptionRecord[]) => {
  const repository = {
    listSubscriptions: vi.fn().mockResolvedValue({
      items: rows,
      total: rows.length,
    }),
    createDelivery: vi
      .fn(async (input: CreateDeliveryInput) => ({
        created: true,
        record: delivery(input.eventId, input.deliveryKey),
      }))
      .mockName('createDelivery'),
    updateDelivery: vi
      .fn(async (uuid: string, input: UpdateDeliveryInput) => ({
        ...delivery('event-1', uuid),
        ...input,
      }))
      .mockName('updateDelivery'),
    listRecentDeliveries: vi.fn().mockResolvedValue([]),
    findDelivery: vi.fn(),
    findSubscriptionByDelivery: vi.fn(),
  } as unknown as SystemWebhookRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const secrets = {
    generate: vi.fn().mockReturnValue({
      secret: 'secret',
      ciphertext: 'ciphertext',
    }),
    decrypt: vi.fn().mockReturnValue('secret'),
  };
  const signer = {
    buildPayload: vi
      .fn()
      .mockImplementation((input: unknown) => JSON.stringify(input)),
    signature: vi.fn().mockReturnValue('signature'),
    payloadHash: vi.fn().mockReturnValue('hash'.padEnd(64, '0')),
  };
  const network = {
    validateTarget: vi
      .fn()
      .mockResolvedValue(new URL('https://example.test/webhook')),
    send: vi.fn().mockResolvedValue({ status: 200 }),
  };
  const config = {
    get: vi.fn((_key: string, fallback: unknown) => fallback),
  };

  const service = new SystemWebhookService(
    repository,
    audit,
    secrets,
    signer,
    network,
    config as never,
  );
  return { service, repository, network };
};

describe('SystemWebhookService', () => {
  it('does not deliver when declarative filters do not match', async () => {
    const row = subscription([
      { field: 'lead.status', operator: 'EQ', value: 'qualified' },
    ]);
    const { service, network } = createService([row]);

    await service.publish('event-1', 'system.activity.created', {
      lead: { status: 'new' },
    });

    expect(network.send).not.toHaveBeenCalled();
  });

  it('delivers when all declarative filters match', async () => {
    const row = subscription([
      { field: 'lead.status', operator: 'EQ', value: 'qualified' },
      { field: 'lead.score', operator: 'GTE', value: 70 },
    ]);
    const { service, network } = createService([row]);

    await service.publish('event-1', 'system.activity.created', {
      lead: { status: 'qualified', score: 80 },
    });

    expect(network.send).toHaveBeenCalledOnce();
  });

  it('uses a distinct delivery key for explicit replay while preserving event identity', async () => {
    const row = subscription();
    const { service, repository, network } = createService([row]);
    repository.findDelivery = vi
      .fn()
      .mockResolvedValue(delivery('event-1', 'original-delivery'));
    repository.findSubscriptionByDelivery = vi.fn().mockResolvedValue(row);

    const createDelivery = vi.fn(async (input: CreateDeliveryInput) => ({
      created: true,
      record: delivery(input.eventId, input.deliveryKey),
    }));
    repository.createDelivery = createDelivery;

    const updateDelivery = vi.fn(
      async (uuid: string, input: UpdateDeliveryInput) => ({
        ...delivery('event-1', uuid),
        ...input,
      }),
    );
    repository.updateDelivery = updateDelivery;

    const result = await service.replay('actor-uuid', 'original-delivery');

    expect(network.send).toHaveBeenCalledOnce();
    expect(createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        deliveryKey: expect.stringMatching(/^replay:/),
      }),
    );
    expect(result.eventId).toBe('event-1');
  });

  it('reports bounded operational delivery health without exposing secrets', async () => {
    const row = subscription();
    const { service, repository } = createService([row]);
    const createdAt = new Date(Date.now() - 1_000);
    const completedAt = new Date();
    repository.listRecentDeliveries = vi.fn().mockResolvedValue([
      {
        ...delivery('event-1', 'delivery-1'),
        createdAt,
        completedAt,
      },
      {
        ...delivery('event-2', 'delivery-2'),
        state: 'DEAD_LETTER',
        attemptCount: 3,
        createdAt,
        completedAt: null,
      },
    ]);

    const result = await service.health('sub-uuid');

    expect(result.deliveries).toEqual({
      total: 2,
      successful: 1,
      failed: 1,
      retried: 1,
    });
    expect(result.averageLatencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(result)).not.toMatch(/secret|ciphertext/i);
  });
});
