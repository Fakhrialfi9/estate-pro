import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticationSessionRepository } from '../domain/repositories/authentication-session.repository.js';
import { AUTHENTICATION_SESSION_REPOSITORY } from '../domain/repositories/authentication-session.repository.js';
import type { SecurityAuditRepository } from '../domain/repositories/security-audit.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from '../domain/repositories/security-audit.repository.js';
import { AUTH_ACTIONS } from '../constants/authentication.constants.js';

export interface LogoutCommand {
  userUuid: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class LogoutService {
  constructor(
    @Inject(AUTHENTICATION_SESSION_REPOSITORY)
    private readonly sessions: AuthenticationSessionRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    const now = new Date();
    await this.sessions.revoke(command.userUuid, command.sessionId, now);
    await this.audit.record({
      action: AUTH_ACTIONS.LOGOUT,
      userUuid: command.userUuid,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      requestId: command.requestId,
    });
  }
}
