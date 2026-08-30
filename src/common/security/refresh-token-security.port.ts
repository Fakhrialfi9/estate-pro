export type RefreshTokenRevokeReason =
  | 'LOGOUT'
  | 'ROTATED'
  | 'REUSE_DETECTED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'SECURITY_EVENT'
  | 'ADMIN_REVOKED'
  | 'SESSION_REVOKED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_LOCKED';

export interface RefreshTokenAuditContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
  actorUserUuid?: string | undefined;
}

export interface RefreshTokenSecurityPort {
  revokeAllForUser(
    userUuid: string,
    reason: RefreshTokenRevokeReason,
    context?: RefreshTokenAuditContext,
  ): Promise<number>;
  revokeForSession(
    userUuid: string,
    sessionId: string,
    reason: RefreshTokenRevokeReason,
    context?: RefreshTokenAuditContext,
  ): Promise<number>;
}

export const REFRESH_TOKEN_SECURITY_PORT = Symbol('REFRESH_TOKEN_SECURITY_PORT');
