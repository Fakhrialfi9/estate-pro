import { describe, expect, it, vi } from 'vitest';

import { SystemWebhookRetryWorker } from '../../../src/modules/system/infrastructure/webhook/system-webhook-retry.worker.js';
import type { SystemWebhookRepository } from '../../../src/modules/system/domain/repositories/system-webhook.repository.js';

const dueDelivery = {
  delivery: {
    uuid: 'delivery-1',
    eventId: 'event-1',
    attemptCount: 2,
    createdAt: new Date(Date.now() - 5000),
    state: 'RETRYING',
  },
  subscription: { uuid: 'sub-1' },
} as never;

describe('SystemWebhookRetryWorker', () => {
  it('claims due deliveries and processes them with bounded batch size', async () => {
    const listDueDeliveries = vi.fn().mockResolvedValue([dueDelivery]);
    const claimDelivery = vi.fn().mockResolvedValue(true);
    const repository = {
      listDueDeliveries,
      claimDelivery,
    } as unknown as SystemWebhookRepository;
    const processQueuedDelivery = vi
      .fn()
      .mockResolvedValue({ state: 'RETRYING' });
    const service = { processQueuedDelivery } as never;
    const worker = new SystemWebhookRetryWorker(repository, service);

    await (worker as unknown as { poll(): Promise<void> }).poll();

    expect(listDueDeliveries).toHaveBeenCalledWith(expect.any(Date), 25);
    expect(claimDelivery).toHaveBeenCalledWith('delivery-1', expect.any(Date));
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
    const service = { processQueuedDelivery } as never;
    const worker = new SystemWebhookRetryWorker(repository, service);

    await (worker as unknown as { poll(): Promise<void> }).poll();

    expect(processQueuedDelivery).not.toHaveBeenCalled();
  });
});
