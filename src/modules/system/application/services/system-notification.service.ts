import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AUTOMATION_NOTIFICATION_PORT,
  type AutomationNotificationPort,
} from '../../../../common/contracts/automation-system.port.js';
import type { NotificationChannel, NotificationPriority } from '../../../automation/domain/notification.types.js';
import type { SystemNotificationsContract } from '../../domain/system-public.contracts.js';
import { SYSTEM_ERROR_CODES } from '../../domain/system-error.codes.js';

@Injectable()
export class SystemNotificationService implements SystemNotificationsContract {
  constructor(
    @Inject(AUTOMATION_NOTIFICATION_PORT)
    private readonly automation: AutomationNotificationPort,
  ) {}

  async list(userUuid: string, page: number, limit: number, unreadOnly: boolean) {
    this.requireUser(userUuid);
    return this.automation.listNotifications({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      unreadOnly,
      userUuid,
    });
  }

  async markRead(userUuid: string, uuid: string) {
    this.requireUser(userUuid);
    const result = await this.automation.markNotificationRead(uuid, userUuid);
    if (!result) {
      throw new NotFoundException({
        code: SYSTEM_ERROR_CODES.NOTIFICATION_NOT_FOUND,
        message: 'Notification not found.',
      });
    }
    return result;
  }

  async markAllRead(userUuid: string): Promise<{ updated: number }> {
    this.requireUser(userUuid);
    return this.automation.markAllNotificationsRead(userUuid);
  }

  preferences(userUuid: string) {
    this.requireUser(userUuid);
    return this.automation.listPreferences(userUuid);
  }

  setPreference(
    userUuid: string,
    input: { notificationType: string; channel: NotificationChannel; enabled: boolean },
  ) {
    this.requireUser(userUuid);
    return this.automation.setPreference({ userUuid, ...input });
  }

  templates(input: { code?: string; activeOnly?: boolean } = {}) {
    return this.automation.listTemplates(input);
  }

  createTemplate(input: {
    actorUuid: string;
    code: string;
    version: number;
    titleTemplate: string;
    bodyTemplate: string;
    variables: readonly string[];
    isActive?: boolean;
  }) {
    return this.automation.createTemplate(input);
  }

  updateTemplate(
    uuid: string,
    input: {
      titleTemplate?: string;
      bodyTemplate?: string;
      variables?: readonly string[];
      isActive?: boolean;
    },
  ) {
    return this.automation.updateTemplate({ uuid, ...input });
  }

  setPolicy(
    notificationUuid: string,
    input: {
      templateUuid?: string | null;
      priority?: NotificationPriority;
      expiresAt?: Date | null;
    },
  ) {
    return this.automation.setPolicy({ notificationUuid, ...input });
  }

  policy(notificationUuid: string) {
    return this.automation.getPolicy(notificationUuid);
  }

  createDelivery(
    notificationUuid: string,
    channel: NotificationChannel,
    maxAttempts?: number,
  ) {
    return this.automation.createDelivery({
      notificationUuid,
      channel,
      maxAttempts,
    });
  }

  deliveries(notificationUuid: string) {
    return this.automation.listDeliveries(notificationUuid);
  }

  private requireUser(userUuid: string): void {
    if (!userUuid) {
      throw new BadRequestException({
        code: 'AUTHENTICATED_ACTOR_MISSING',
        message: 'Authenticated actor missing.',
      });
    }
  }
}
