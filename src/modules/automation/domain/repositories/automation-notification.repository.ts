import type {
  NotificationChannel,
  NotificationDeliveryRecord,
  NotificationPreferenceRecord,
  NotificationPriority,
  NotificationPolicyRecord,
  NotificationTemplateRecord,
} from '../notification.types.js';

export const AUTOMATION_NOTIFICATION_REPOSITORY = Symbol(
  'AUTOMATION_NOTIFICATION_REPOSITORY',
);

export interface AutomationNotificationRepository {
  createNotification(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  listPreferences(userUuid: string): Promise<readonly NotificationPreferenceRecord[]>;
  upsertPreference(input: {
    userUuid: string;
    notificationType: string;
    channel: NotificationChannel;
    enabled: boolean;
  }): Promise<NotificationPreferenceRecord>;
  listTemplates(input?: {
    code?: string;
    activeOnly?: boolean;
  }): Promise<readonly NotificationTemplateRecord[]>;
  createTemplate(input: {
    uuid: string;
    code: string;
    version: number;
    titleTemplate: string;
    bodyTemplate: string;
    variables: readonly string[];
    isActive: boolean;
  }): Promise<NotificationTemplateRecord>;
  updateTemplate(
    uuid: string,
    input: Partial<
      Pick<
        NotificationTemplateRecord,
        'titleTemplate' | 'bodyTemplate' | 'variables' | 'isActive'
      >
    >,
  ): Promise<NotificationTemplateRecord>;
  upsertPolicy(input: {
    notificationUuid: string;
    templateUuid?: string | null;
    priority?: NotificationPriority;
    expiresAt?: Date | null;
  }): Promise<NotificationPolicyRecord>;
  getPolicy(notificationUuid: string): Promise<NotificationPolicyRecord | null>;
  createDelivery(input: {
    notificationUuid: string;
    channel: NotificationChannel;
    maxAttempts?: number;
    availableAt?: Date | null;
  }): Promise<NotificationDeliveryRecord>;
  getDelivery(uuid: string): Promise<NotificationDeliveryRecord | null>;
  listDueDeliveries(now: Date, limit: number): Promise<readonly NotificationDeliveryRecord[]>;
  updateDelivery(
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
  ): Promise<NotificationDeliveryRecord>;
  listNotificationDeliveries(notificationUuid: string): Promise<readonly NotificationDeliveryRecord[]>;
}
