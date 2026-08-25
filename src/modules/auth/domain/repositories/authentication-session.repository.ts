export interface AuthenticationSessionCreation {
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export interface AuthenticationSessionRepository {
  create(
    userUuid: string,
    session: AuthenticationSessionCreation,
  ): Promise<void>;
  revoke(userUuid: string, sessionId: string, now: Date): Promise<void>;
  isActive(userUuid: string, sessionId: string, now: Date): Promise<boolean>;
}

export const AUTHENTICATION_SESSION_REPOSITORY = Symbol(
  'AUTHENTICATION_SESSION_REPOSITORY',
);
