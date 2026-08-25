import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticationSessionCreation,
  AuthenticationSessionRepository,
  SessionAuditContext,
  SessionListQuery,
} from '../domain/repositories/authentication-session.repository.js';
import { AUTHENTICATION_SESSION_REPOSITORY } from '../domain/repositories/authentication-session.repository.js';
import type { SessionSecurityPort } from '../../../../common/security/session-security.port.js';
import { SessionEntity } from '../domain/entities/session.entity.js';
import type { SecurityAuditRepository } from '../domain/repositories/security-audit.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from '../domain/repositories/security-audit.repository.js';

export const SESSION_AUDIT_ACTIONS = {
  CREATED: 'SESSION_CREATED',
  REVOKED: 'SESSION_REVOKED',
  LOGOUT: 'SESSION_LOGOUT',
  LOGOUT_ALL: 'SESSION_LOGOUT_ALL',
  ADMIN_REVOKED: 'SESSION_ADMIN_REVOKED',
  PASSWORD_CHANGE_REVOKED: 'PASSWORD_CHANGE_SESSION_REVOKED',
  SECURITY_EVENT_REVOKED: 'SECURITY_EVENT_SESSION_REVOKED',
} as const;

const MAX_PAGE_SIZE = 100;
const MAX_USER_AGENT_LENGTH = 1024;
const SESSION_SECRET_BYTES = 32;

export interface CreateSessionInput extends SessionAuditContext {
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService implements SessionSecurityPort {
  constructor(
    @Inject(AUTHENTICATION_SESSION_REPOSITORY)
    private readonly sessions: AuthenticationSessionRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  static generateSecret(): string {
    return randomBytes(SESSION_SECRET_BYTES).toString('base64url');
  }

  static digestSecret(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }

  async create(userUuid: string, input: CreateSessionInput): Promise<SessionEntity> {
    const now = new Date();
    if (input.expiresAt.getTime() <= now.getTime()) {
      throw new Error('Session expiry must be in the future');
    }
    const creation: AuthenticationSessionCreation = {
      sessionId: input.sessionId,
      ipAddress: input.ipAddress,
      userAgent: this.normalizeUserAgent(input.userAgent),
      expiresAt: input.expiresAt,
    };
    const snapshot = await this.sessions.create(userUuid, creation);
    const entity = SessionEntity.create(snapshot);
    await this.audit.record({
      action: SESSION_AUDIT_ACTIONS.CREATED,
      userUuid,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
    });
    return entity;
  }

  async isActive(userUuid: string, sessionId: string, now = new Date()): Promise<boolean> {
    return this.sessions.isActive(userUuid, sessionId, now);
  }

  async listOwn(
    userUuid: string,
    query: Partial<SessionListQuery> = {},
    now = new Date(),
  ): Promise<ReturnType<SessionEntity['toSafeView']>[]> {
    const normalized: SessionListQuery = {
      limit: Math.min(Math.max(query.limit ?? 20, 1), MAX_PAGE_SIZE),
      offset: Math.max(query.offset ?? 0, 0),
      includeInactive: query.includeInactive ?? false,
    };
    const snapshots = await this.sessions.list(userUuid, normalized);
    return snapshots.map((snapshot) => SessionEntity.create(snapshot).toSafeView(now));
  }

  async logoutCurrent(
    userUuid: string,
    sessionId: string,
    context: SessionAuditContext = {},
  ): Promise<void> {
    await this.sessions.revokeBySecret(userUuid, sessionId, new Date());
    await this.audit.record({
      action: SESSION_AUDIT_ACTIONS.LOGOUT,
      userUuid,
      ...context,
    });
  }

  async revokeOwnSession(
    userUuid: string,
    publicSessionId: string,
    context: SessionAuditContext = {},
  ): Promise<void> {
    await this.sessions.revokeById(userUuid, publicSessionId, new Date());
    await this.audit.record({
      action: SESSION_AUDIT_ACTIONS.REVOKED,
      userUuid,
      ...context,
    });
  }

  async logoutAll(
    userUuid: string,
    context: SessionAuditContext = {},
  ): Promise<number> {
    const count = await this.sessions.revokeAll(userUuid, new Date());
    await this.audit.record({
      action: SESSION_AUDIT_ACTIONS.LOGOUT_ALL,
      userUuid,
      ...context,
    });
    return count;
  }

  async adminRevoke(
    actorUserUuid: string,
    targetUserUuid: string,
    publicSessionId: string,
    context: SessionAuditContext = {},
  ): Promise<void> {
    await this.sessions.revokeById(targetUserUuid, publicSessionId, new Date());
    await this.audit.record({
      action: SESSION_AUDIT_ACTIONS.ADMIN_REVOKED,
      userUuid: targetUserUuid,
      actorUserUuid,
      ...context,
    });
  }

  async revokeAllForSecurityEvent(
    userUuid: string,
    event: Parameters<SessionSecurityPort['revokeAllForSecurityEvent']>[1],
    context: SessionAuditContext = {},
  ): Promise<number> {
    const count = await this.sessions.revokeAll(userUuid, new Date());
    await this.audit.record({
      action:
        event === 'PASSWORD_CHANGE'
          ? SESSION_AUDIT_ACTIONS.PASSWORD_CHANGE_REVOKED
          : SESSION_AUDIT_ACTIONS.SECURITY_EVENT_REVOKED,
      userUuid,
      ...context,
    });
    return count;
  }

  private normalizeUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    return userAgent.slice(0, MAX_USER_AGENT_LENGTH);
  }
}
