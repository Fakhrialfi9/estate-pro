import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { NotificationDeliveryRecord } from '../../domain/notification.types.js';
import {
  AUTOMATION_NOTIFICATION_REPOSITORY,
  type AutomationNotificationRepository,
} from '../../domain/repositories/automation-notification.repository.js';

const MAX_RETRY_DELAY_MS = 60_000;
const RETRY_JITTER_MS = 250;

const retryDelayMs = (attemptCount: number): number => {
  const exponential = 1000 * 2 ** Math.min(Math.max(attemptCount - 1, 0), 6);
  const jitter = Math.floor(Math.random() * (RETRY_JITTER_MS + 1));
  return Math.min(MAX_RETRY_DELAY_MS, exponential + jitter);
};

@Injectable()
export class AutomationNotificationDeliveryService {
  constructor(
    @Inject(AUTOMATION_NOTIFICATION_REPOSITORY)
    private readonly repository: AutomationNotificationRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async processDue(
    limit = 25,
  ): Promise<{ processed: number; sent: number; failed: number }> {
    const due = await this.repository.listDueDeliveries(
      new Date(),
      Math.min(100, Math.max(1, limit)),
    );
    let sent = 0;
    let failed = 0;
    for (const delivery of due) {
      const result = await this.process(delivery);
      if (result.state === 'SENT') sent += 1;
      if (result.state === 'FAILED') failed += 1;
    }
    return { processed: due.length, sent, failed };
  }

  async retry(
    uuid: string,
    actorUuid: string,
  ): Promise<NotificationDeliveryRecord> {
    const current = await this.repository.getDelivery(uuid);
    if (!current)
      throw new NotFoundException('Notification delivery not found');
    if (current.state !== 'FAILED') return current;
    if (current.attemptCount >= current.maxAttempts) return current;

    const nextAttempt = current.attemptCount + 1;
    const next = await this.repository.updateDelivery(uuid, {
      state: 'QUEUED',
      availableAt: new Date(Date.now() + retryDelayMs(nextAttempt)),
      errorMessage: null,
    });
    await this.audit.record({
      action: 'NOTIFICATION_DELIVERY_RETRIED',
      actorUuid,
      entityType: 'notification_delivery',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: `attempt=${nextAttempt};max=${next.maxAttempts}`,
    });
    return next;
  }

  private async process(delivery: NotificationDeliveryRecord) {
    const nextAttempt = delivery.attemptCount + 1;
    await this.repository.updateDelivery(delivery.uuid, {
      state: 'SENDING',
      attemptCount: nextAttempt,
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

    const terminal = nextAttempt >= delivery.maxAttempts;
    const result = await this.repository.updateDelivery(delivery.uuid, {
      state: terminal ? 'FAILED' : 'QUEUED',
      availableAt: terminal
        ? null
        : new Date(Date.now() + retryDelayMs(nextAttempt)),
      errorMessage: terminal
        ? `No notification provider is configured for ${delivery.channel}`
        : `Notification provider unavailable for ${delivery.channel}`,
    });

    await this.audit.record({
      action: terminal
        ? 'NOTIFICATION_DELIVERY_FAILED'
        : 'NOTIFICATION_DELIVERY_RETRY_SCHEDULED',
      actorUuid: null,
      entityType: 'notification_delivery',
      entityUuid: delivery.uuid,
      result: terminal ? 'FAILURE' : 'SUCCESS',
      reason: terminal
        ? `channel=${delivery.channel};attempt=${nextAttempt};max=${delivery.maxAttempts}`
        : `channel=${delivery.channel};attempt=${nextAttempt};nextRetry=true`,
      system: true,
    });
    return result;
  }
}
