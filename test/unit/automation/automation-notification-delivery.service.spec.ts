import { describe, expect, it, vi } from 'vitest';
import { AutomationNotificationDeliveryService } from '../../../src/modules/automation/application/services/automation-notification-delivery.service.js';
import type { NotificationDeliveryRecord } from '../../../src/modules/automation/domain/notification.types.js';

const baseDelivery = (overrides: Partial<NotificationDeliveryRecord> = {}): NotificationDeliveryRecord => ({
  uuid: 'delivery-1',
  notificationUuid: 'notification-1',
  channel: 'EMAIL',
  state: 'FAILED',
  attemptCount: 1,
  maxAttempts: 3,
  availableAt: null,
  sentAt: null,
  providerMessageId: null,
  errorMessage: 'provider unavailable',
  createdAt: new Date('2026-09-07T00:00:00.000Z'),
  updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  ...overrides,
});

describe('AutomationNotificationDeliveryService', () => {
  it('schedules manual retry with bounded exponential backoff and audits it', async () => {
    const current = baseDelivery({ attemptCount: 2 });
    const next = baseDelivery({ state: 'QUEUED', attemptCount: 2 });
    const repository = {
      getDelivery: vi.fn().mockResolvedValue(current),
      updateDelivery: vi.fn().mockResolvedValue(next),
      listDueDeliveries: vi.fn(),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new AutomationNotificationDeliveryService(
      repository as never,
      audit as never,
    );

    const result = await service.retry('delivery-1', 'actor-1');

    expect(result).toBe(next);
    expect(repository.updateDelivery).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({ state: 'QUEUED', errorMessage: null }),
    );
    const [, update] = repository.updateDelivery.mock.calls[0];
    expect(update.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(update.availableAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 4250,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTIFICATION_DELIVERY_RETRIED',
        actorUuid: 'actor-1',
      }),
    );
  });

  it('marks unsupported provider delivery as queued until max attempts and audits retry', async () => {
    const delivery = baseDelivery({ state: 'QUEUED', attemptCount: 0 });
    const repository = {
      listDueDeliveries: vi.fn().mockResolvedValue([delivery]),
      updateDelivery: vi
        .fn()
        .mockResolvedValueOnce({ ...delivery, state: 'SENDING', attemptCount: 1 })
        .mockResolvedValueOnce({
          ...delivery,
          state: 'QUEUED',
          attemptCount: 1,
          availableAt: new Date(Date.now() + 1000),
        }),
      getDelivery: vi.fn(),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new AutomationNotificationDeliveryService(
      repository as never,
      audit as never,
    );

    const result = await service.processDue();

    expect(result).toEqual({ processed: 1, sent: 0, failed: 0 });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTIFICATION_DELIVERY_RETRIED',
        result: 'SUCCESS',
      }),
    );
  });

  it('does not retry a delivery after max attempts', async () => {
    const current = baseDelivery({ attemptCount: 3, maxAttempts: 3 });
    const repository = {
      getDelivery: vi.fn().mockResolvedValue(current),
      updateDelivery: vi.fn(),
    };
    const audit = { record: vi.fn() };
    const service = new AutomationNotificationDeliveryService(
      repository as never,
      audit as never,
    );

    await expect(service.retry('delivery-1', 'actor-1')).resolves.toBe(current);
    expect(repository.updateDelivery).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
