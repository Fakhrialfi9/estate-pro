import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CredentialRepository,
  UserRepository,
} from '../../../users/users.module.js';
import {
  CREDENTIAL_REPOSITORY,
  USER_REPOSITORY,
} from '../../../users/users.module.js';
import { PasswordHasherService } from './password-hasher.service.js';
import { JwtTokenService } from './jwt-token.service.js';
import { SessionService } from './session.service.js';
import type {
  AuthenticationSecurityRepository,
  AuthenticationLockoutPolicy,
} from '../../domain/repositories/authentication-security.repository.js';
import { AUTHENTICATION_SECURITY_REPOSITORY } from '../../domain/repositories/authentication-security.repository.js';
import type { SecurityAuditRepository } from '../../domain/repositories/security-audit.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../domain/repositories/security-audit.repository.js';
import {
  AUTH_ACTIONS,
  AUTH_FAILURE_REASONS,
} from '../constants/authentication.constants.js';
import { TwoFactorService } from './two-factor.service.js';

export interface LoginCommand {
  identifier: string;
  password: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface AccessTokenLoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
export interface MfaRequiredLoginResponse {
  mfaRequired: true;
  challengeToken: string;
  expiresIn: number;
}
export type LoginResponse = AccessTokenLoginResponse | MfaRequiredLoginResponse;

@Injectable()
export class LoginService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(AUTHENTICATION_SECURITY_REPOSITORY)
    private readonly security: AuthenticationSecurityRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly hasher: PasswordHasherService,
    private readonly jwt: JwtTokenService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResponse | null> {
    const now = new Date();
    const policy: AuthenticationLockoutPolicy = {
      threshold: this.config.getOrThrow<number>('auth.login.lockoutThreshold'),
      windowMs: this.config.getOrThrow<number>('auth.login.lockoutWindowMs'),
      durationMs: this.config.getOrThrow<number>(
        'auth.login.lockoutDurationMs',
      ),
    };
    const identifier = command.identifier.trim();
    const user =
      (await this.users.findByEmail(identifier)) ??
      (await this.users.findByUsername(identifier));
    if (!user) {
      await this.auditFailure(
        command,
        AUTH_FAILURE_REASONS.INVALID_CREDENTIALS,
      );
      return null;
    }
    const state = await this.security.getState(user.uuid);
    if (this.isLocked(state.lockedUntil, now)) {
      await this.auditFailure(
        command,
        AUTH_FAILURE_REASONS.ACCOUNT_LOCKED,
        user.uuid,
      );
      return null;
    }
    if (!user.isAccessible() || user.status !== 'active') {
      await this.auditFailure(
        command,
        AUTH_FAILURE_REASONS.ACCOUNT_DISABLED,
        user.uuid,
      );
      return null;
    }
    const credential = await this.credentials.findByUserUuid(user.uuid);
    const validPassword = credential
      ? await this.hasher.verify(credential.passwordHash, command.password)
      : false;
    if (!validPassword) {
      await this.security.recordFailedLogin(user.uuid, now, policy);
      await this.auditFailure(
        command,
        AUTH_FAILURE_REASONS.INVALID_CREDENTIALS,
        user.uuid,
      );
      return null;
    }
    const latestState = await this.security.getState(user.uuid);
    if (this.isLocked(latestState.lockedUntil, now)) {
      await this.auditFailure(
        command,
        AUTH_FAILURE_REASONS.ACCOUNT_LOCKED,
        user.uuid,
      );
      return null;
    }
    if (await this.twoFactor.isEnabled(user.uuid)) {
      const challenge = await this.twoFactor.createLoginChallenge(user.uuid);
      return {
        mfaRequired: true,
        challengeToken: challenge.token,
        expiresIn: challenge.expiresIn,
      };
    }
    return this.issueSession(user.uuid, command, now);
  }

  async executeMfa(input: {
    challengeToken: string;
    code?: string | undefined;
    recoveryCode?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
  }): Promise<AccessTokenLoginResponse | null> {
    const userUuid = await this.twoFactor.verifyLoginChallenge({
      token: input.challengeToken,
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.recoveryCode !== undefined
        ? { recoveryCode: input.recoveryCode }
        : {}),
      context: {
        ...(input.ipAddress !== undefined
          ? { ipAddress: input.ipAddress }
          : {}),
        ...(input.userAgent !== undefined
          ? { userAgent: input.userAgent }
          : {}),
        ...(input.requestId !== undefined
          ? { requestId: input.requestId }
          : {}),
      },
    });
    const user = await this.users.findByUuid(userUuid);
    if (!user || !user.isAccessible() || user.status !== 'active') return null;
    const state = await this.security.getState(userUuid);
    const now = new Date();
    if (this.isLocked(state.lockedUntil, now)) return null;
    return this.issueSession(userUuid, input, now);
  }

  private async issueSession(
    userUuid: string,
    command:
      | LoginCommand
      | {
          ipAddress?: string | undefined;
          userAgent?: string | undefined;
          requestId?: string | undefined;
        },
    now: Date,
  ): Promise<AccessTokenLoginResponse> {
    const sessionId = SessionService.generateSecret();
    const accessToken = await this.jwt.issueAccessToken(userUuid, sessionId);
    const expiresAt = this.jwt.getExpiresAt(accessToken);
    await this.sessions.create(userUuid, {
      sessionId,
      expiresAt,
      ...(command.ipAddress !== undefined
        ? { ipAddress: command.ipAddress }
        : {}),
      ...(command.userAgent !== undefined
        ? { userAgent: command.userAgent }
        : {}),
      ...(command.requestId !== undefined
        ? { requestId: command.requestId }
        : {}),
    });
    await this.security.recordSuccessfulLogin(userUuid, now, {
      ipAddress: command.ipAddress,
    });
    await this.audit.record({
      action: AUTH_ACTIONS.LOGIN_SUCCESS,
      actorUuid: userUuid,
      subjectUuid: userUuid,
      entityType: 'authentication',
      result: 'SUCCESS',
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      requestId: command.requestId,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: Math.max(
        1,
        Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
      ),
    };
  }

  private async auditFailure(
    command: LoginCommand,
    reason: string,
    subjectUuid?: string,
  ): Promise<void> {
    await this.audit.record({
      action: AUTH_ACTIONS.LOGIN_FAILURE,
      ...(subjectUuid !== undefined ? { subjectUuid } : {}),
      entityType: 'authentication',
      result: 'FAILURE',
      reason,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      requestId: command.requestId,
    });
  }

  private isLocked(lockedUntil: Date | null, now: Date): boolean {
    return lockedUntil !== null && lockedUntil > now;
  }
}
