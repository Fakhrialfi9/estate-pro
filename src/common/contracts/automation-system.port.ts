import type {
  NotificationChannel,
  NotificationPreferenceRecord,
  NotificationPriority,
  NotificationPolicyRecord,
  NotificationTemplateRecord,
} from '../../modules/automation/domain/notification.types.js';

export const AUTOMATION_SYSTEM_PORT = Symbol('AUTOMATION_SYSTEM_PORT');

export const AUTOMATION_NOTIFICATION_PORT = Symbol(
  'AUTOMATION_NOTIFICATION_PORT',
);

export type AutomationSystemPort = Readonly<{
  listExecutions(
    input: { page: number; limit: number; state?: string },
    actorUuid: string,
  ): Promise<unknown>;
  getExecution(uuid: string, actorUuid: string): Promise<unknown>;
  retryExecution(uuid: string, actorUuid: string): Promise<unknown>;
  cancelExecution(uuid: string, actorUuid: string): Promise<unknown>;
}>;

export type AutomationNotificationPort = Readonly<{
  listNotifications(input: {
    userUuid: string;
    page: number;
    limit: number;
    unreadOnly: boolean;
  }): Promise<unknown>;
  markNotificationRead(uuid: string, userUuid: string): Promise<unknown>;
  markAllNotificationsRead(userUuid: string): Promise<{ updated: number }>;
  listPreferences(userUuid: string): Promise<readonly NotificationPreferenceRecord[]>;
  setPreference(input: {
    userUuid: string;
    notificationType: string;
    channel: NotificationChannel;
    enabled: boolean;
  }): Promise<NotificationPreferenceRecord>;
  listTemplates(input?: { code?: string; activeOnly?: boolean }): Promise<readonly NotificationTemplateRecord[]>;
  createTemplate(input: {
    actorUuid: string;
    code: string;
    version: number;
    titleTemplate: string;
    bodyTemplate: string;
    variables: readonly string[];
    isActive?: boolean;
  }): Promise<NotificationTemplateRecord>;
  updateTemplate(input: {
    uuid: string;
    titleTemplate?: string;
    bodyTemplate?: string;
    variables?: readonly string[];
    isActive?: boolean;
  }): Promise<NotificationTemplateRecord>;
  setPolicy(input: {
    notificationUuid: string;
    templateUuid?: string | null;
    priority?: NotificationPriority;
    expiresAt?: Date | null;
  }): Promise<NotificationPolicyRecord>;
  getPolicy(notificationUuid: string): Promise<NotificationPolicyRecord>;
  createDelivery(input: {
    notificationUuid: string;
    channel: NotificationChannel;
    maxAttempts?: number;
  }): Promise<unknown>;
  listDeliveries(notificationUuid: string): Promise<readonly unknown[]>;
}>;
