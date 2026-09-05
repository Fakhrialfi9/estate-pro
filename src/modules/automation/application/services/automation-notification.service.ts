import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  type NotificationChannel,
  type NotificationPriority,
} from '../../domain/notification.types.js';
import {
  AUTOMATION_NOTIFICATION_REPOSITORY,
  type AutomationNotificationRepository,
} from '../../domain/repositories/automation-notification.repository.js';

const MAX_TEMPLATE_VARIABLES = 32;
const VARIABLE_PATTERN = /^[a-zA-Z0-9_.-]{1,80}$/;

@Injectable()
export class AutomationNotificationService {
  constructor(
    @Inject(AUTOMATION_NOTIFICATION_REPOSITORY)
    private readonly repository: AutomationNotificationRepository,
  ) {}

  createNotification(input: Record<string, unknown>) {
    const userUuid =
      typeof input.userUuid === 'string' ? input.userUuid.trim() : '';
    const type = typeof input.type === 'string' ? input.type.trim() : '';
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    if (!userUuid || !type || !title || !body)
      throw new BadRequestException('Invalid notification payload');
    if (!/^[A-Za-z0-9_.-]{1,50}$/.test(type))
      throw new BadRequestException('Invalid notification type');
    if (title.length > 180 || body.length > 10000)
      throw new BadRequestException('Notification content exceeds limits');
    const priority = input.priority === undefined ? 'NORMAL' : input.priority;
    if (
      typeof priority !== 'string' ||
      !NOTIFICATION_PRIORITIES.includes(priority as NotificationPriority)
    )
      throw new BadRequestException('Invalid notification priority');
    return this.repository.createNotification({
      uuid: randomUUID(),
      userUuid,
      type,
      title,
      body,
      priority,
      referenceType:
        typeof input.referenceType === 'string'
          ? input.referenceType.trim().slice(0, 80)
          : null,
      referenceUuid:
        typeof input.referenceUuid === 'string'
          ? input.referenceUuid.trim()
          : null,
      metadata:
        input.metadata &&
        typeof input.metadata === 'object' &&
        !Array.isArray(input.metadata)
          ? input.metadata
          : {},
    });
  }

  listPreferences(userUuid: string) {
    return this.repository.listPreferences(userUuid);
  }

  async setPreference(
    userUuid: string,
    input: {
      notificationType: string;
      channel: NotificationChannel;
      enabled: boolean;
    },
  ) {
    if (!userUuid) throw new BadRequestException('Authenticated actor missing');
    const type = input.notificationType.trim();
    if (!/^[A-Za-z0-9_.-]{1,50}$/.test(type))
      throw new BadRequestException('Invalid notification type');
    if (!NOTIFICATION_CHANNELS.includes(input.channel))
      throw new BadRequestException('Invalid notification channel');
    return this.repository.upsertPreference({
      userUuid,
      notificationType: type,
      channel: input.channel,
      enabled: input.enabled === true,
    });
  }

  listTemplates(input: { code?: string; activeOnly?: boolean } = {}) {
    return this.repository.listTemplates(input);
  }

  async createTemplate(input: {
    code: string;
    version: number;
    titleTemplate: string;
    bodyTemplate: string;
    variables: readonly string[];
    isActive?: boolean;
    actorUuid: string;
  }) {
    const code = input.code.trim();
    const title = input.titleTemplate.trim();
    const body = input.bodyTemplate.trim();
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(code))
      throw new BadRequestException('Invalid notification template code');
    if (
      !Number.isInteger(input.version) ||
      input.version < 1 ||
      input.version > 10000
    )
      throw new BadRequestException('Invalid template version');
    if (!title || title.length > 180 || !body || body.length > 10000)
      throw new BadRequestException('Invalid notification template content');
    const variables = [
      ...new Set(input.variables.map((value) => value.trim()).filter(Boolean)),
    ];
    if (
      variables.length > MAX_TEMPLATE_VARIABLES ||
      variables.some((value) => !VARIABLE_PATTERN.test(value))
    )
      throw new BadRequestException('Invalid template variables');
    return this.repository.createTemplate({
      uuid: randomUUID(),
      code,
      version: input.version,
      titleTemplate: title,
      bodyTemplate: body,
      variables,
      isActive: input.isActive !== false,
    });
  }

  async updateTemplate(
    uuid: string,
    input: Partial<{
      titleTemplate: string;
      bodyTemplate: string;
      variables: readonly string[];
      isActive: boolean;
    }>,
  ) {
    if (!uuid) throw new BadRequestException('Invalid template identifier');
    const patch: Parameters<
      AutomationNotificationRepository['updateTemplate']
    >[1] = {};
    if (input.titleTemplate !== undefined) {
      const value = input.titleTemplate.trim();
      if (!value || value.length > 180)
        throw new BadRequestException('Invalid template title');
      patch.titleTemplate = value;
    }
    if (input.bodyTemplate !== undefined) {
      const value = input.bodyTemplate.trim();
      if (!value || value.length > 10000)
        throw new BadRequestException('Invalid template body');
      patch.bodyTemplate = value;
    }
    if (input.variables !== undefined) {
      const variables = [
        ...new Set(
          input.variables.map((value) => value.trim()).filter(Boolean),
        ),
      ];
      if (
        variables.length > MAX_TEMPLATE_VARIABLES ||
        variables.some((value) => !VARIABLE_PATTERN.test(value))
      )
        throw new BadRequestException('Invalid template variables');
      patch.variables = variables;
    }
    if (input.isActive !== undefined) patch.isActive = input.isActive === true;
    return this.repository.updateTemplate(uuid, patch);
  }

  async setPolicy(
    notificationUuid: string,
    input: {
      templateUuid?: string | null;
      priority?: NotificationPriority;
      expiresAt?: Date | null;
    },
  ) {
    if (!notificationUuid)
      throw new BadRequestException('Invalid notification identifier');
    if (
      input.priority !== undefined &&
      !NOTIFICATION_PRIORITIES.includes(input.priority)
    )
      throw new BadRequestException('Invalid notification priority');
    if (input.expiresAt && input.expiresAt.getTime() <= Date.now())
      throw new BadRequestException(
        'Notification expiry must be in the future',
      );
    return this.repository.upsertPolicy({ notificationUuid, ...input });
  }

  async getPolicy(notificationUuid: string) {
    const result = await this.repository.getPolicy(notificationUuid);
    if (!result) throw new NotFoundException('Notification policy not found');
    return result;
  }

  createDelivery(
    notificationUuid: string,
    channel: NotificationChannel,
    maxAttempts = 3,
  ) {
    if (!notificationUuid)
      throw new BadRequestException('Invalid notification identifier');
    if (!NOTIFICATION_CHANNELS.includes(channel))
      throw new BadRequestException('Invalid notification channel');
    return this.repository.createDelivery({
      notificationUuid,
      channel,
      maxAttempts: Math.min(10, Math.max(1, maxAttempts)),
    });
  }

  listDeliveries(notificationUuid: string) {
    return this.repository.listNotificationDeliveries(notificationUuid);
  }
}
