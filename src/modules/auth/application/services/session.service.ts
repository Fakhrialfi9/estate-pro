import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticationSessionRepository, SessionAuditContext, SessionListQuery } from '../../domain/repositories/authentication-session.repository.js';
import { AUTHENTICATION_SESSION_REPOSITORY } from '../../domain/repositories/authentication-session.repository.js';
import { SessionEntity } from '../../domain/entities/session.entity.js';
import type { SessionSecurityPort } from '../../../../common/security/session-security.port.js';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import { REFRESH_TOKEN_SECURITY_PORT, type RefreshTokenSecurityPort, type RefreshTokenRevokeReason } from '../../../../common/security/refresh-token-security.port.js';
import { createHash, randomBytes } from 'node:crypto';

export const SESSION_AUDIT_ACTIONS = { CREATED: 'SESSION_CREATED', REVOKED: 'SESSION_REVOKED', LOGOUT: 'LOGOUT', LOGOUT_ALL: 'LOGOUT_ALL_SESSIONS', ADMIN_REVOKED: 'SESSION_ADMIN_REVOKED', PASSWORD_CHANGE_REVOKED: 'PASSWORD_CHANGE_SESSION_REVOKED', SECURITY_EVENT_REVOKED: 'SECURITY_EVENT_SESSION_REVOKED' } as const;
const MAX_PAGE_SIZE = 100;
const MAX_USER_AGENT_LENGTH = 1024;
const SESSION_SECRET_BYTES = 32;
export interface CreateSessionInput extends SessionAuditContext { sessionId: string; ipAddress?: string | undefined; userAgent?: string | undefined; expiresAt: Date; }

@Injectable()
export class SessionService implements SessionSecurityPort {
  constructor(
    @Inject(AUTHENTICATION_SESSION_REPOSITORY) private readonly sessions: AuthenticationSessionRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY) private readonly audit: SecurityAuditRepository,
    @Inject(REFRESH_TOKEN_SECURITY_PORT) private readonly refreshTokens: RefreshTokenSecurityPort,
  ) {}

  static generateSecret(): string { return randomBytes(SESSION_SECRET_BYTES).toString('base64url'); }
  static digestSecret(secret: string): string { return createHash('sha256').update(secret, 'utf8').digest('hex'); }

  async create(userUuid: string, input: CreateSessionInput): Promise<SessionEntity> {
    const now = new Date();
    if (input.expiresAt.getTime() <= now.getTime()) throw new Error('Session expiry must be in the future');
    const snapshot = await this.sessions.create(userUuid, { sessionId: input.sessionId, ipAddress: input.ipAddress, userAgent: input.userAgent ? input.userAgent.slice(0, MAX_USER_AGENT_LENGTH) : undefined, expiresAt: input.expiresAt });
    const entity = SessionEntity.create(snapshot);
    await this.audit.record({ action: SESSION_AUDIT_ACTIONS.CREATED, actorUuid: userUuid, subjectUuid: userUuid, entityType: 'session', result: 'SUCCESS', ipAddress: input.ipAddress, userAgent: input.userAgent, requestId: input.requestId });
    return entity;
  }

  async isActive(userUuid: string, sessionIdentifier: string, now = new Date()): Promise<boolean> {
    if (/^\d+$/.test(sessionIdentifier)) {
      const session = await this.sessions.findById(userUuid, sessionIdentifier);
      return session ? SessionEntity.create(session).isActiveAt(now) : false;
    }
    const session = await this.sessions.findBySecret(userUuid, sessionIdentifier);
    return session ? SessionEntity.create(session).isActiveAt(now) : false;
  }

  async listOwn(userUuid: string, query: Partial<SessionListQuery> = {}, now = new Date()) {
    const normalized: SessionListQuery = { limit: Math.min(Math.max(query.limit ?? 20, 1), MAX_PAGE_SIZE), offset: Math.max(query.offset ?? 0, 0), includeInactive: query.includeInactive ?? false };
    const snapshots = await this.sessions.list(userUuid, normalized);
    return snapshots.map((snapshot) => SessionEntity.create(snapshot).toSafeView(now));
  }

  async logoutCurrent(userUuid: string, sessionIdentifier: string, context: SessionAuditContext = {}): Promise<void> {
    const now = new Date();
    if (/^\d+$/.test(sessionIdentifier)) await this.sessions.revokeById(userUuid, sessionIdentifier, now);
    else await this.sessions.revokeBySecret(userUuid, sessionIdentifier, now);
    await this.refreshTokens.revokeForSession(userUuid, sessionIdentifier, 'LOGOUT', context);
    await this.audit.record({ action: SESSION_AUDIT_ACTIONS.LOGOUT, actorUuid: context.actorUserUuid ?? userUuid, subjectUuid: userUuid, entityType: 'session', result: 'SUCCESS', ipAddress: context.ipAddress, userAgent: context.userAgent, requestId: context.requestId });
  }

  async revokeOwnSession(userUuid: string, publicSessionId: string, context: SessionAuditContext = {}): Promise<void> {
    await this.sessions.revokeById(userUuid, publicSessionId, new Date());
    await this.refreshTokens.revokeForSession(userUuid, publicSessionId, 'SESSION_REVOKED', context);
    await this.audit.record({ action: SESSION_AUDIT_ACTIONS.REVOKED, actorUuid: context.actorUserUuid ?? userUuid, subjectUuid: userUuid, entityType: 'session', result: 'SUCCESS', ipAddress: context.ipAddress, userAgent: context.userAgent, requestId: context.requestId });
  }

  async logoutAll(userUuid: string, context: SessionAuditContext = {}): Promise<number> {
    const now = new Date();
    const count = await this.sessions.revokeAll(userUuid, now);
    await this.refreshTokens.revokeAllForUser(userUuid, 'LOGOUT', context);
    await this.audit.record({ action: SESSION_AUDIT_ACTIONS.LOGOUT_ALL, actorUuid: context.actorUserUuid ?? userUuid, subjectUuid: userUuid, entityType: 'session', result: 'SUCCESS', ipAddress: context.ipAddress, userAgent: context.userAgent, requestId: context.requestId });
    return count;
  }

  async adminRevoke(actorUserUuid: string, targetUserUuid: string, publicSessionId: string, context: SessionAuditContext = {}): Promise<void> {
    const now = new Date();
    await this.sessions.revokeById(targetUserUuid, publicSessionId, now);
    await this.refreshTokens.revokeForSession(targetUserUuid, publicSessionId, 'ADMIN_REVOKED', context);
    await this.audit.record({ action: SESSION_AUDIT_ACTIONS.ADMIN_REVOKED, actorUuid: actorUserUuid, subjectUuid: targetUserUuid, entityType: 'session', result: 'SUCCESS', ipAddress: context.ipAddress, userAgent: context.userAgent, requestId: context.requestId });
  }

  async revokeAllForSecurityEvent(userUuid: string, event: Parameters<SessionSecurityPort['revokeAllForSecurityEvent']>[1], context: SessionAuditContext = {}): Promise<number> {
    const now = new Date();
    const count = await this.sessions.revokeAll(userUuid, now);
    const reason: RefreshTokenRevokeReason = event === 'PASSWORD_CHANGE' ? 'PASSWORD_CHANGED' : event === 'PASSWORD_RESET' ? 'PASSWORD_RESET' : event === 'ACCOUNT_DISABLED' ? 'ACCOUNT_DISABLED' : event === 'ACCOUNT_LOCKED' ? 'ACCOUNT_LOCKED' : event === 'ACCOUNT_COMPROMISE' ? 'SECURITY_EVENT' : event === 'ADMIN_FORCED_LOGOUT' ? 'ADMIN_REVOKED' : 'SECURITY_EVENT';
    await this.refreshTokens.revokeAllForUser(userUuid, reason, context);
    await this.audit.record({ action: event === 'PASSWORD_CHANGE' ? SESSION_AUDIT_ACTIONS.PASSWORD_CHANGE_REVOKED : SESSION_AUDIT_ACTIONS.SECURITY_EVENT_REVOKED, actorUuid: context.actorUserUuid ?? userUuid, subjectUuid: userUuid, entityType: 'session', result: 'SUCCESS', ipAddress: context.ipAddress, userAgent: context.userAgent, requestId: context.requestId });
    return count;
  }
}
