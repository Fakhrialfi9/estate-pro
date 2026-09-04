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
}>;
