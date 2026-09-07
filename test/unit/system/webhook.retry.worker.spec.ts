import { describe, expect, it, vi } from 'vitest';

import { SystemWebhookRetryWorker } from '../../../src/modules/system/infrastructure/webhook/system-webhook-retry.worker.js';
import type { SystemWebhookRepository } from '../../../src/modules/system/domain/repositories/system-webhook.repository.js';
import type { WebhookDeliveryRecord } from '../../../src/modules/system/domain/webhook/webhook.contracts.js';

const dueDelivery: Readonly<{
  delivery: WebhookDeliveryRecord;
  subscription: { uuid: string };
}> = {
  delivery: {
    id: 1n,
    uuid: 'delivery-1',
    subscriptionId: 1n,
    eventId: 'event-1',
    deliveryKey: 'delivery-key-1',
    eventName: 'system.activity.created',
    eventVersion: 1,
    payloadHash: 'hash'.padEnd(64, '0'),
    payload: {},
    attemptCount: 2,
    state: 'RETRYING',
    httpStatus: null,
    responseSummary: null,
    nextAttemptAt: null,
    signedAt: new Date(),
    completedAt: null,
    failureReason: null,
    createdAt: new Date(Date.now() - 5000),
    updatedAt: new Date(),
  },
  subscription: { uuid: 'sub-1' },
};

describe('SystemWebhookRetryWorker', () => {
  it('claims due deliveries and processes them with bounded batch size', async () => {
    const listDueDeliveries = vi.fn().mockResolvedValue([dueDelivery]);
    const claimDelivery = vi.fn().mockResolvedValue(true);
    const updateDelivery = vi.fn().mockResolvedValue({
      ...dueDelivery.delivery,
      attemptCount: dueDelivery.delivery.attemptCount + 1,
      state: 'DELIVERING',
    });
    const repository = {
      listDueDeliveries,
      claimDelivery,
      updateDelivery,
    } as unknown as SystemWebhookRepository;
    const processQueuedDelivery = vi
      .fn()
      .mockResolvedValue({ state: 'RETRYING' });
    const service = { processQueuedDelivery };
    const worker = new SystemWebhookRetryWorker(repository, service as never);

    await (worker as unknown as { poll(): Promise<void> }).poll();

    expect(listDueDeliveries).toHaveBeenCalledWith(expect.any(Date), 25);
    expect(claimDelivery).toHaveBeenCalledWith('delivery-1', expect.any(Date));
    expect(updateDelivery).toHaveBeenCalledWith('delivery-1', {
      attemptCount: 3,
      state: 'DELIVERING',
    });
    expect(processQueuedDelivery).toHaveBeenCalledWith('delivery-1');
  });

  it('does not process a delivery claimed by another worker', async () => {
    const listDueDeliveries = vi.fn().mockResolvedValue([dueDelivery]);
    const claimDelivery = vi.fn().mockResolvedValue(false);
    const repository = {
      listDueDeliveries,
      claimDelivery,
    } as unknown as SystemWebhookRepository;
    const processQueuedDelivery = vi.fn();
    const service = { processQueuedDelivery };
    const worker = new SystemWebhookRetryWorker(repository, service as never);

    await (worker as unknown as { poll(): Promise<void> }).poll();

    expect(processQueuedDelivery).not.toHaveBeenCalled();
  });
});
