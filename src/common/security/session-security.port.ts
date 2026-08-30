export interface SessionAuditContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
  actorUserUuid?: string | undefined;
}

export type SessionSecurityEvent =
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'ACCOUNT_COMPROMISE'
  | 'SECURITY_STATE_CHANGE'
  | 'ADMIN_FORCED_LOGOUT'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_LOCKED'
  | 'TWO_FACTOR_CHANGE';

export interface SessionSecurityPort {
  revokeAllForSecurityEvent(
    userUuid: string,
    event: SessionSecurityEvent,
    context?: SessionAuditContext,
  ): Promise<number>;
}

export const SESSION_SECURITY_PORT = Symbol('SESSION_SECURITY_PORT');
