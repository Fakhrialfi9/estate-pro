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
  const findDelivery =
    vi.fn<(uuid: string) => Promise<WebhookDeliveryRecord | null>>();
  const findSubscriptionByDelivery =
    vi.fn<(uuid: string) => Promise<WebhookSubscriptionRecord | null>>();
  const createDelivery = vi.fn((input: CreateDeliveryInput) =>
    Promise.resolve({
      created: true,
      record: delivery(input.eventId, input.deliveryKey),
    }),
  );
  const updateDelivery = vi.fn((uuid: string, input: UpdateDeliveryInput) =>
    Promise.resolve({
      ...delivery('event-1', uuid),
      ...input,
    }),
  );
  const listRecentDeliveries = vi.fn(() =>
    Promise.resolve([] as readonly WebhookDeliveryRecord[]),
  );
  const repository = {
    listSubscriptions: vi.fn().mockResolvedValue({
      items: rows,
      total: rows.length,
    }),
    createDelivery,
    updateDelivery,
    listRecentDeliveries,
    findDelivery,
    findSubscriptionByDelivery,
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
  return {
    service,
    network,
    findDelivery,
    findSubscriptionByDelivery,
    createDelivery,
    updateDelivery,
    listRecentDeliveries,
  };
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
    const {
      service,
      network,
      findDelivery,
      findSubscriptionByDelivery,
      createDelivery,
      updateDelivery,
    } = createService([row]);
    findDelivery.mockResolvedValue(delivery('event-1', 'original-delivery'));
    findSubscriptionByDelivery.mockResolvedValue(row);

    await service.replay('actor-uuid', 'original-delivery');

    expect(network.send).toHaveBeenCalledOnce();
    expect(createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        deliveryKey: expect.stringMatching(/^replay:/),
      }),
    );
    expect(updateDelivery).toHaveBeenCalled();
    expect(findDelivery).toHaveBeenCalledWith('original-delivery');
    expect(findSubscriptionByDelivery).toHaveBeenCalledWith(
      'original-delivery',
    );
  });

  it('reports bounded operational delivery health without exposing secrets', async () => {
    const row = subscription();
    const { service, listRecentDeliveries } = createService([row]);
    const createdAt = new Date(Date.now() - 1_000);
    const completedAt = new Date();
    listRecentDeliveries.mockResolvedValue([
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
