import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { UserRepository } from '../../../users/domain/repositories/user.repository.js';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository.js';
import type { CredentialRepository } from '../../../users/credentials/domain/repositories/credential.repository.js';
import { CREDENTIAL_REPOSITORY } from '../../../users/credentials/domain/repositories/credential.repository.js';
import { PasswordHasherService } from './password-hasher.service.js';
import { JwtTokenService } from './jwt-token.service.js';
import type { AuthenticationSecurityRepository, AuthenticationLockoutPolicy } from '../domain/repositories/authentication-security.repository.js';
import { AUTHENTICATION_SECURITY_REPOSITORY } from '../domain/repositories/authentication-security.repository.js';
import type { AuthenticationSessionRepository } from '../domain/repositories/authentication-session.repository.js';
import { AUTHENTICATION_SESSION_REPOSITORY } from '../domain/repositories/authentication-session.repository.js';
import type { SecurityAuditRepository } from '../domain/repositories/security-audit.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from '../domain/repositories/security-audit.repository.js';
import { AUTH_ACTIONS } from '../constants/authentication.constants.js';

export interface LoginCommand { identifier: string; password: string; ipAddress?: string; userAgent?: string; requestId?: string; }
export interface LoginResponse { accessToken: string; tokenType: 'Bearer'; expiresIn: number; }

@Injectable()
export class LoginService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(AUTHENTICATION_SECURITY_REPOSITORY) private readonly security: AuthenticationSecurityRepository,
    @Inject(AUTHENTICATION_SESSION_REPOSITORY) private readonly sessions: AuthenticationSessionRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY) private readonly audit: SecurityAuditRepository,
    private readonly hasher: PasswordHasherService,
    private readonly jwt: JwtTokenService,
    private readonly config: ConfigService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResponse | null> {
    const now = new Date();
    const policy: AuthenticationLockoutPolicy = {
      threshold: this.config.getOrThrow<number>('auth.login.lockoutThreshold'),
      windowMs: this.config.getOrThrow<number>('auth.login.lockoutWindowMs'),
      durationMs: this.config.getOrThrow<number>('auth.login.lockoutDurationMs'),
    };
    const identifier = command.identifier.trim();
    const user = (await this.users.findByEmail(identifier)) ?? (await this.users.findByUsername(identifier));
    if (!user) { await this.auditFailure(command); return null; }
    const state = await this.security.getState(user.uuid);
    if (this.isLocked(state.lockedUntil, now)) { await this.auditFailure(command, user.uuid); return null; }
    if (!user.isAccessible() || user.status !== 'active') { await this.auditFailure(command, user.uuid); return null; }
    const credential = await this.credentials.findByUserUuid(user.uuid);
    const validPassword = credential ? await this.hasher.verify(credential.passwordHash, command.password) : false;
    if (!validPassword) {
      await this.security.recordFailedLogin(user.uuid, now, policy);
      await this.auditFailure(command, user.uuid);
      return null;
    }
    const latestState = await this.security.getState(user.uuid);
    if (this.isLocked(latestState.lockedUntil, now)) { await this.auditFailure(command, user.uuid); return null; }
    const sessionId = randomBytes(32).toString('base64url');
    const accessToken = await this.jwt.issueAccessToken(user.uuid, sessionId);
    const expiresAt = this.jwt.getExpiresAt(accessToken);
    await this.sessions.create(user.uuid, { sessionId, ipAddress: command.ipAddress, userAgent: command.userAgent, expiresAt });
    await this.security.recordSuccessfulLogin(user.uuid, now, { ipAddress: command.ipAddress });
    await this.audit.record({ action: AUTH_ACTIONS.LOGIN_SUCCESS, userUuid: user.uuid, ipAddress: command.ipAddress, userAgent: command.userAgent, requestId: command.requestId });
    return { accessToken, tokenType: 'Bearer', expiresIn: Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)) };
  }

  private async auditFailure(command: LoginCommand, userUuid?: string): Promise<void> {
    await this.audit.record({ action: AUTH_ACTIONS.LOGIN_FAILURE, userUuid, ipAddress: command.ipAddress, userAgent: command.userAgent, requestId: command.requestId });
  }
  private isLocked(lockedUntil: Date | null, now: Date): boolean { return lockedUntil !== null && lockedUntil > now; }
}
