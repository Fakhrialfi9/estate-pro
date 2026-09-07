import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type {
  NotificationDeliveryRecord,
  NotificationDeliveryState,
} from '../../domain/notification.types.js';
import {
  AUTOMATION_NOTIFICATION_REPOSITORY,
  type AutomationNotificationRepository,
} from '../../domain/repositories/automation-notification.repository.js';

const RETRYABLE_DELAY_MS = 1000;

@Injectable()
export class AutomationNotificationDeliveryService {
  constructor(
    @Inject(AUTOMATION_NOTIFICATION_REPOSITORY)
    private readonly repository: AutomationNotificationRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async processDue(limit = 25): Promise<{ processed: number; sent: number; failed: number }> {
    const due = await this.repository.listDueDeliveries(new Date(), Math.min(100, Math.max(1, limit)));
    let sent = 0;
    let failed = 0;
    for (const delivery of due) {
      const result = await this.process(delivery);
      if (result.state === 'SENT') sent += 1;
      if (result.state === 'FAILED') failed += 1;
    }
    return { processed: due.length, sent, failed };
  }

  async retry(uuid: string, actorUuid: string): Promise<NotificationDeliveryRecord> {
    const current = await this.repository.getDelivery(uuid);
    if (!current) throw new NotFoundException('Notification delivery not found');
    if (current.state !== 'FAILED') return current;
    if (current.attemptCount >= current.maxAttempts)
      return current;

    const next = await this.repository.updateDelivery(uuid, {
      state: 'QUEUED',
      availableAt: new Date(Date.now() + RETRYABLE_DELAY_MS),
      errorMessage: null,
    });
    await this.audit.record({
      action: 'NOTIFICATION_DELIVERY_RETRIED',
      actorUuid,
      entityType: 'notification_delivery',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: `attempt=${next.attemptCount};max=${next.maxAttempts}`,
    });
    return next;
  }

  private async process(delivery: NotificationDeliveryRecord) {
    await this.repository.updateDelivery(delivery.uuid, {
      state: 'SENDING',
      attemptCount: delivery.attemptCount + 1,
    });

    if (delivery.channel === 'IN_APP') {
      const sent = await this.repository.updateDelivery(delivery.uuid, {
        state: 'SENT',
        sentAt: new Date(),
        availableAt: null,
        errorMessage: null,
      });
      await this.audit.record({
        action: 'NOTIFICATION_DELIVERED',
        actorUuid: null,
        entityType: 'notification_delivery',
        entityUuid: delivery.uuid,
        result: 'SUCCESS',
        reason: 'IN_APP',
        system: true,
      });
      return sent;
    }

    const nextAttempt = delivery.attemptCount + 1;
    const terminal = nextAttempt >= delivery.maxAttempts;
    return this.repository.updateDelivery(delivery.uuid, {
      state: terminal ? 'FAILED' : 'QUEUED',
      attemptCount: nextAttempt,
      availableAt: terminal
        ? null
        : new Date(Date.now() + 1000 * 2 ** Math.min(nextAttempt - 1, 6)),
      errorMessage: terminal
        ? `No notification provider is configured for ${delivery.channel}`
        : `Notification provider unavailable for ${delivery.channel}`,
    });
  }
}
