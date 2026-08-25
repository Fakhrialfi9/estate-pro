import type { SessionSnapshot } from '../entities/session.entity.js';
import type { SessionAuditContext } from '../../../../common/security/session-security.port.js';

export interface AuthenticationSessionCreation {
  sessionId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
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
  ): Promise<SessionSnapshot>;
  findBySecret(
    userUuid: string,
    sessionId: string,
  ): Promise<SessionSnapshot | null>;
  findById(userUuid: string, id: string): Promise<SessionSnapshot | null>;
  list(userUuid: string, query: SessionListQuery): Promise<SessionSnapshot[]>;
  revokeBySecret(
    userUuid: string,
    sessionId: string,
    now: Date,
  ): Promise<boolean>;
  revokeById(userUuid: string, id: string, now: Date): Promise<boolean>;
  revokeAll(userUuid: string, now: Date): Promise<number>;
  isActive(userUuid: string, sessionId: string, now: Date): Promise<boolean>;
}

export const AUTHENTICATION_SESSION_REPOSITORY = Symbol(
  'AUTHENTICATION_SESSION_REPOSITORY',
);

export type { SessionAuditContext };
