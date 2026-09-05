import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  NotificationChannel,
  NotificationDeliveryRecord,
  NotificationDeliveryState,
  NotificationPreferenceRecord,
  NotificationPriority,
  NotificationPolicyRecord,
  NotificationTemplateRecord,
} from '../../domain/notification.types.js';
import type { AutomationNotificationRepository } from '../../domain/repositories/automation-notification.repository.js';

const clean = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      typeof entry === 'bigint' ? entry.toString() : entry,
    ]),
  );
};

const listOfStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const toTemplate = (
  row: Record<string, unknown>,
): NotificationTemplateRecord => ({
  uuid: String(row.uuid),
  code: String(row.code),
  version: Number(row.version),
  titleTemplate: String(row.titleTemplate),
  bodyTemplate: String(row.bodyTemplate),
  variables: listOfStrings(row.variables),
  isActive: row.isActive === true,
  createdAt: row.createdAt as Date,
  updatedAt: row.updatedAt as Date,
});

const toPreference = (
  row: Record<string, unknown>,
): NotificationPreferenceRecord => ({
  uuid: String(row.uuid),
  userUuid: String(row.userUuid),
  notificationType: String(row.notificationType),
  channel: row.channel as NotificationChannel,
  enabled: row.enabled === true,
  createdAt: row.createdAt as Date,
  updatedAt: row.updatedAt as Date,
});

const toPolicy = (row: Record<string, unknown>): NotificationPolicyRecord => ({
  uuid: String(row.uuid),
  notificationUuid: String(row.notificationUuid),
  templateUuid: row.templateUuid as string | null,
  priority: row.priority as NotificationPriority,
  expiresAt: row.expiresAt as Date | null,
  createdAt: row.createdAt as Date,
  updatedAt: row.updatedAt as Date,
});

const toDelivery = (
  row: Record<string, unknown>,
): NotificationDeliveryRecord => ({
  uuid: String(row.uuid),
  notificationUuid: String(row.notificationUuid),
  channel: row.channel as NotificationChannel,
  state: row.state as NotificationDeliveryState,
  attemptCount: Number(row.attemptCount),
  maxAttempts: Number(row.maxAttempts),
  availableAt: row.availableAt as Date | null,
  sentAt: row.sentAt as Date | null,
  providerMessageId: row.providerMessageId as string | null,
  errorMessage: row.errorMessage as string | null,
  createdAt: row.createdAt as Date,
  updatedAt: row.updatedAt as Date,
});

@Injectable()
export class PrismaAutomationNotificationRepository
  implements AutomationNotificationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(input: Record<string, unknown>) {
    const priority =
      typeof input.priority === 'string' ? input.priority : 'NORMAL';
    const metadata =
      input.metadata &&
      typeof input.metadata === 'object' &&
      !Array.isArray(input.metadata)
        ? input.metadata
        : {};
    const notification = await this.prisma.automationNotification.create({
      data: {
        uuid: String(input.uuid),
        userUuid: String(input.userUuid),
        type: String(input.type),
        title: String(input.title),
        body: String(input.body),
        entityType:
          typeof input.entityType === 'string' ? input.entityType : null,
        entityUuid:
          typeof input.entityUuid === 'string' ? input.entityUuid : null,
        status: typeof input.status === 'string' ? input.status : 'UNREAD',
      },
    });
    await this.prisma.automationNotificationPolicy.create({
      data: {
        uuid: randomUUID(),
        notificationUuid: notification.uuid,
        priority,
        templateUuid: null,
        expiresAt: null,
      },
    });
    return { ...clean(notification), priority, metadata };
  }

  async listPreferences(userUuid: string) {
    const rows = await this.prisma.automationNotificationPreference.findMany({
      where: { userUuid },
      orderBy: [{ notificationType: 'asc' }, { channel: 'asc' }],
    });
    return rows.map((row) => toPreference(clean(row)));
  }

  async upsertPreference(input: {
    userUuid: string;
    notificationType: string;
    channel: NotificationChannel;
    enabled: boolean;
  }) {
    const row = await this.prisma.automationNotificationPreference.upsert({
      where: {
        userUuid_notificationType_channel: {
          userUuid: input.userUuid,
          notificationType: input.notificationType,
          channel: input.channel,
        },
      },
      create: { uuid: randomUUID(), ...input },
      update: { enabled: input.enabled },
    });
    return toPreference(clean(row));
  }

  async listTemplates(input: { code?: string; activeOnly?: boolean } = {}) {
    const rows = await this.prisma.automationNotificationTemplate.findMany({
      where: {
        ...(input.code ? { code: input.code } : {}),
        ...(input.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
    });
    return rows.map((row) => toTemplate(clean(row)));
  }

  async createTemplate(input: {
    uuid: string;
    code: string;
    version: number;
    titleTemplate: string;
    bodyTemplate: string;
    variables: readonly string[];
    isActive: boolean;
  }) {
    const row = await this.prisma.automationNotificationTemplate.create({
      data: { ...input, variables: [...input.variables] },
    });
    return toTemplate(clean(row));
  }

  async updateTemplate(
    uuid: string,
    input: Partial<
      Pick<
        NotificationTemplateRecord,
        'titleTemplate' | 'bodyTemplate' | 'variables' | 'isActive'
      >
    >,
  ) {
    const row = await this.prisma.automationNotificationTemplate.update({
      where: { uuid },
      data: {
        ...(input.titleTemplate !== undefined
          ? { titleTemplate: input.titleTemplate }
          : {}),
        ...(input.bodyTemplate !== undefined
          ? { bodyTemplate: input.bodyTemplate }
          : {}),
        ...(input.variables !== undefined
          ? { variables: [...input.variables] }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return toTemplate(clean(row));
  }

  async upsertPolicy(input: {
    notificationUuid: string;
    templateUuid?: string | null;
    priority?: NotificationPriority;
    expiresAt?: Date | null;
  }) {
    const row = await this.prisma.automationNotificationPolicy.upsert({
      where: { notificationUuid: input.notificationUuid },
      create: {
        uuid: randomUUID(),
        notificationUuid: input.notificationUuid,
        templateUuid: input.templateUuid ?? null,
        priority: input.priority ?? 'NORMAL',
        expiresAt: input.expiresAt ?? null,
      },
      update: {
        ...(input.templateUuid !== undefined
          ? { templateUuid: input.templateUuid }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt }
          : {}),
      },
    });
    return toPolicy(clean(row));
  }

  async getPolicy(notificationUuid: string) {
    const row = await this.prisma.automationNotificationPolicy.findUnique({
      where: { notificationUuid },
    });
    return row ? toPolicy(clean(row)) : null;
  }

  async createDelivery(input: {
    notificationUuid: string;
    channel: NotificationChannel;
    maxAttempts?: number;
    availableAt?: Date | null;
  }) {
    const row = await this.prisma.automationNotificationDelivery.create({
      data: {
        uuid: randomUUID(),
        notificationUuid: input.notificationUuid,
        channel: input.channel,
        maxAttempts: Math.min(10, Math.max(1, input.maxAttempts ?? 3)),
        availableAt: input.availableAt ?? new Date(),
      },
    });
    return toDelivery(clean(row));
  }

  async getDelivery(uuid: string) {
    const row = await this.prisma.automationNotificationDelivery.findUnique({
      where: { uuid },
    });
    return row ? toDelivery(clean(row)) : null;
  }

  async listDueDeliveries(now: Date, limit: number) {
    const rows = await this.prisma.automationNotificationDelivery.findMany({
      where: {
        state: 'QUEUED',
        OR: [{ availableAt: null }, { availableAt: { lte: now } }],
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(100, Math.max(1, limit)),
    });
    return rows.map((row) => toDelivery(clean(row)));
  }

  async updateDelivery(
    uuid: string,
    input: Partial<
      Pick<
        NotificationDeliveryRecord,
        | 'state'
        | 'attemptCount'
        | 'availableAt'
        | 'sentAt'
        | 'providerMessageId'
        | 'errorMessage'
      >
    >,
  ) {
    const row = await this.prisma.automationNotificationDelivery.update({
      where: { uuid },
      data: input,
    });
    return toDelivery(clean(row));
  }

  async listNotificationDeliveries(notificationUuid: string) {
    const rows = await this.prisma.automationNotificationDelivery.findMany({
      where: { notificationUuid },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toDelivery(clean(row)));
  }
}
