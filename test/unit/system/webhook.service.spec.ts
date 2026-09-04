import { describe, expect, it, vi } from 'vitest';

import { SystemWebhookService } from '../../../src/modules/system/application/services/system-webhook.service.js';
import type {
  SystemWebhookRepository,
} from '../../../src/modules/system/domain/repositories/system-webhook.repository.js';
import {
  SYSTEM_WEBHOOK_REPOSITORY,
} from '../../../src/modules/system/domain/repositories/system-webhook.repository.js';
import {
  SYSTEM_WEBHOOK_NETWORK_PORT,
  SYSTEM_WEBHOOK_SECRET_PORT,
  SYSTEM_WEBHOOK_SIGNER_PORT,
} from '../../../src/modules/system/domain/webhook/webhook.ports.js';
import type { WebhookSubscriptionRecord } from '../../../src/modules/system/domain/webhook/webhook.contracts.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../src/common/audit/security-audit.port.js';

const subscription = (filters = []) =>
  ({
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
  }) as WebhookSubscriptionRecord;

const delivery = (eventId: string, deliveryKey: string) => ({
  id: 1n,
  uuid: deliveryKey,
  subscriptionId: 1n,
  eventId,
  deliveryKey,
  eventName: 'system.activity.created' as const,
  eventVersion: 1,
  payloadHash: 'hash'.padEnd(64, '0'),
  attemptCount: 1,
  state: 'SUCCEEDED' as const,
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
    createDelivery: vi.fn().mockResolvedValue({
      created: true,
      record: delivery('event-1', 'event-1'),
    }),
    updateDelivery: vi.fn().mockResolvedValue(delivery('event-1', 'event-1')),
  } as unknown as SystemWebhookRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const secrets = {
    generate: vi.fn().mockReturnValue({ secret: 'secret', ciphertext: 'ciphertext' }),
    decrypt: vi.fn().mockReturnValue('secret'),
  };
  const signer = {
    buildPayload: vi.fn().mockImplementation((input) => JSON.stringify(input)),
    signature: vi.fn().mockReturnValue('signature'),
    payloadHash: vi.fn().mockReturnValue('hash'.padEnd(64, '0')),
  };
  const network = {
    validateTarget: vi.fn().mockResolvedValue(new URL('https://example.test/webhook')),
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
  return { service, repository, network, signer, audit };
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
    repository.findDelivery = vi.fn().mockResolvedValue(delivery('event-1', 'original-delivery'));
    repository.findSubscriptionByDelivery = vi.fn().mockResolvedValue(row);
    repository.createDelivery = vi.fn().mockImplementation(async (input) => ({
      created: true,
      record: delivery(input.eventId, input.deliveryKey),
    }));
    repository.updateDelivery = vi.fn().mockImplementation(async (uuid, input) => ({
      ...delivery('event-1', uuid),
      ...input,
    }));

    const result = await service.replay('actor-uuid', 'original-delivery');

    expect(network.send).toHaveBeenCalledOnce();
    expect(repository.createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        deliveryKey: expect.stringMatching(/^replay:/),
      }),
    );
    expect(result.eventId).toBe('event-1');
  });
});
