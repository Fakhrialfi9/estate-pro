export const AUTOMATION_SYSTEM_PORT = Symbol('AUTOMATION_SYSTEM_PORT');
export const AUTOMATION_NOTIFICATION_PORT = Symbol('AUTOMATION_NOTIFICATION_PORT');

export type NotificationChannelContract = 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'SMS';
export type NotificationPriorityContract = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export interface NotificationPreferenceContract {
  readonly uuid: string;
  readonly userUuid: string;
  readonly notificationType: string;
  readonly channel: NotificationChannelContract;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface NotificationTemplateContract {
  readonly uuid: string;
  readonly code: string;
  readonly version: number;
  readonly titleTemplate: string;
  readonly bodyTemplate: string;
  readonly variables: readonly string[];
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface NotificationPolicyContract {
  readonly uuid: string;
  readonly notificationUuid: string;
  readonly templateUuid: string | null;
  readonly priority: NotificationPriorityContract;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export type AutomationSystemPort = Readonly<{
  listExecutions(input: { page: number; limit: number; state?: string }, actorUuid: string): Promise<unknown>;
  getExecution(uuid: string, actorUuid: string): Promise<unknown>;
  retryExecution(uuid: string, actorUuid: string): Promise<unknown>;
  cancelExecution(uuid: string, actorUuid: string): Promise<unknown>;
}>;
export type AutomationNotificationPort = Readonly<{
  createNotification(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  listNotifications(input: { userUuid: string; page: number; limit: number; unreadOnly: boolean }): Promise<unknown>;
  markNotificationRead(uuid: string, userUuid: string): Promise<unknown>;
  markAllNotificationsRead(userUuid: string): Promise<{ updated: number }>;
  listPreferences(userUuid: string): Promise<readonly NotificationPreferenceContract[]>;
  setPreference(input: { userUuid: string; notificationType: string; channel: NotificationChannelContract; enabled: boolean }): Promise<NotificationPreferenceContract>;
  listTemplates(input?: { code?: string; activeOnly?: boolean }): Promise<readonly NotificationTemplateContract[]>;
  createTemplate(input: { actorUuid: string; code: string; version: number; titleTemplate: string; bodyTemplate: string; variables: readonly string[]; isActive?: boolean }): Promise<NotificationTemplateContract>;
  updateTemplate(input: { uuid: string; titleTemplate?: string; bodyTemplate?: string; variables?: readonly string[]; isActive?: boolean }): Promise<NotificationTemplateContract>;
  setPolicy(input: { notificationUuid: string; templateUuid?: string | null; priority?: NotificationPriorityContract; expiresAt?: Date | null }): Promise<NotificationPolicyContract>;
  getPolicy(notificationUuid: string): Promise<NotificationPolicyContract>;
  createDelivery(input: { notificationUuid: string; channel: NotificationChannelContract; maxAttempts?: number }): Promise<unknown>;
  listDeliveries(notificationUuid: string): Promise<readonly unknown[]>;
}>;
