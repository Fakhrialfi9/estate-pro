import { describe, expect, it, vi } from 'vitest';
import { AutomationNotificationDeliveryService } from '../../../src/modules/automation/application/services/automation-notification-delivery.service.js';
import type {
  NotificationDeliveryRecord,
} from '../../../src/modules/automation/domain/notification.types.js';
import type { AutomationNotificationRepository } from '../../../src/modules/automation/domain/repositories/automation-notification.repository.js';

const baseDelivery = (
  overrides: Partial<NotificationDeliveryRecord> = {},
): NotificationDeliveryRecord => ({
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
    const getDelivery = vi
      .fn<AutomationNotificationRepository['getDelivery']>()
      .mockResolvedValue(current);
    const updateDelivery = vi
      .fn<AutomationNotificationRepository['updateDelivery']>()
      .mockResolvedValue(next);
    const repository = {
      getDelivery,
      updateDelivery,
      listDueDeliveries: vi.fn<AutomationNotificationRepository['listDueDeliveries']>(),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new AutomationNotificationDeliveryService(
      repository,
      audit,
    );

    const result = await service.retry('delivery-1', 'actor-1');

    expect(result).toBe(next);
    expect(updateDelivery).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({ state: 'QUEUED', errorMessage: null }),
    );
    const updateCall = updateDelivery.mock.calls.at(0);
    if (updateCall === undefined) {
      throw new Error('Notification delivery update was not called');
    }
    const update = updateCall[1];
    expect(update.availableAt).toBeInstanceOf(Date);
    expect(update.availableAt?.getTime()).toBeGreaterThan(Date.now());
    expect(update.availableAt?.getTime()).toBeLessThanOrEqual(
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
    const listDueDeliveries = vi
      .fn<AutomationNotificationRepository['listDueDeliveries']>()
      .mockResolvedValue([delivery]);
    const updateDelivery = vi
      .fn<AutomationNotificationRepository['updateDelivery']>()
      .mockResolvedValueOnce({
        ...delivery,
        state: 'SENDING',
        attemptCount: 1,
      })
      .mockResolvedValueOnce({
        ...delivery,
        state: 'QUEUED',
        attemptCount: 1,
        availableAt: new Date(Date.now() + 1000),
      });
    const repository = {
      listDueDeliveries,
      updateDelivery,
      getDelivery: vi.fn<AutomationNotificationRepository['getDelivery']>(),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new AutomationNotificationDeliveryService(
      repository,
      audit,
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
    const getDelivery = vi
      .fn<AutomationNotificationRepository['getDelivery']>()
      .mockResolvedValue(current);
    const updateDelivery = vi.fn<AutomationNotificationRepository['updateDelivery']>();
    const repository = {
      getDelivery,
      updateDelivery,
    };
    const audit = { record: vi.fn() };
    const service = new AutomationNotificationDeliveryService(
      repository,
      audit,
    );

    await expect(service.retry('delivery-1', 'actor-1')).resolves.toBe(current);
    expect(updateDelivery).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
