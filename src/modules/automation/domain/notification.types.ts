export const NOTIFICATION_CHANNELS = [
  'IN_APP',
  'EMAIL',
  'WHATSAPP',
  'SMS',
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_DELIVERY_STATES = [
  'QUEUED',
  'SENDING',
  'SENT',
  'FAILED',
] as const;
export type NotificationDeliveryState =
  (typeof NOTIFICATION_DELIVERY_STATES)[number];

export interface NotificationTemplateRecord {
  uuid: string;
  code: string;
  version: number;
  titleTemplate: string;
  bodyTemplate: string;
  variables: readonly string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferenceRecord {
  uuid: string;
  userUuid: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPolicyRecord {
  uuid: string;
  notificationUuid: string;
  templateUuid: string | null;
  priority: NotificationPriority;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDeliveryRecord {
  uuid: string;
  notificationUuid: string;
  channel: NotificationChannel;
  state: NotificationDeliveryState;
  attemptCount: number;
  maxAttempts: number;
  availableAt: Date | null;
  sentAt: Date | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
