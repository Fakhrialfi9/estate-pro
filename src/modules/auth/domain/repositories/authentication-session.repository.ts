import type { SessionAuditContext } from '../../../../common/security/session-security.port.js';

export interface AuthenticationSessionCreation {
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export interface SessionListQuery {
  limit: number;
  offset: number;
  includeInactive?: boolean;
}

export interface AuthenticationSessionRepository {
  create(
    userUuid: string,
    session: AuthenticationSessionCreation,
  ): Promise<import('../entities/session.entity.js').SessionSnapshot>;
  findBySecret(
    userUuid: string,
    sessionId: string,
  ): Promise<import('../entities/session.entity.js').SessionSnapshot | null>;
  findById(
    userUuid: string,
    id: string,
  ): Promise<import('../entities/session.entity.js').SessionSnapshot | null>;
  list(
    userUuid: string,
    query: SessionListQuery,
  ): Promise<import('../entities/session.entity.js').SessionSnapshot[]>;
  revokeBySecret(
    userUuid: string,
    sessionId: string,
    now: Date,
  ): Promise<boolean>;
  revokeById(userUuid: string, id: string, now: Date): Promise<boolean>;
  revokeAll(userUuid: string, now: Date): Promise<number>;
  isActive(userUuid: string, sessionId: string, now: Date): Promise<boolean>;
}

export { type SessionAuditContext };

export const AUTHENTICATION_SESSION_REPOSITORY = Symbol(
  'AUTHENTICATION_SESSION_REPOSITORY',
);
