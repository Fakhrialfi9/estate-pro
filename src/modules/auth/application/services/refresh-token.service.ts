import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import { JwtTokenService } from './jwt-token.service.js';
import {
  RefreshTokenCryptoService,
  REFRESH_TOKEN_STRING_LENGTH,
} from './refresh-token-crypto.service.js';
import { RefreshTokenObservabilityService } from './refresh-token-observability.service.js';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.js';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.js';
import type { RefreshTokenFamilyRepository } from '../../domain/repositories/refresh-token-family.repository.js';
import { REFRESH_TOKEN_FAMILY_REPOSITORY } from '../../domain/repositories/refresh-token-family.repository.js';
import {
  RefreshTokenExpiredError,
  RefreshTokenInvalidError,
  RefreshTokenReuseDetectedError,
  RefreshTokenRevokedError,
} from '../../domain/errors/refresh-token.errors.js';
import type { SessionEntity } from '../../domain/entities/session.entity.js';

export interface RefreshLoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}
export type RefreshRequestContext = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly tokens: RefreshTokenRepository,
    @Inject(REFRESH_TOKEN_FAMILY_REPOSITORY)
    private readonly families: RefreshTokenFamilyRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly jwt: JwtTokenService,
    private readonly crypto: RefreshTokenCryptoService,
    private readonly config: ConfigService,
    private readonly observability: RefreshTokenObservabilityService,
  ) {}

  async issueForSession(
    userUuid: string,
    session: SessionEntity,
    now = new Date(),
  ): Promise<RefreshLoginResponse> {
    const ttlMs = this.getRefreshTtlMs();
    const refreshToken = this.crypto.generate();
    const expiresAt = new Date(now.getTime() + ttlMs);
    await this.families.createWithInitialToken({
      userUuid,
      sessionId: session.id,
      tokenHash: this.crypto.digest(refreshToken),
      issuedAt: now,
      expiresAt,
    });
    const accessToken = await this.jwt.issueAccessToken(userUuid, session.id);
    await this.audit.record({
      action: 'REFRESH_TOKEN_ISSUED',
      actorUuid: userUuid,
      subjectUuid: userUuid,
      entityType: 'authentication_refresh_token',
      result: 'SUCCESS',
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken,
      refreshTokenExpiresIn: Math.floor(ttlMs / 1000),
    };
  }

  async refresh(
    rawToken: string,
    context: RefreshRequestContext = {},
  ): Promise<RefreshLoginResponse> {
    const telemetry = this.observability.start(context.requestId);
    let successful = false;

    try {
      if (
        rawToken.length !== REFRESH_TOKEN_STRING_LENGTH ||
        !/^[A-Za-z0-9_-]+$/.test(rawToken)
      ) {
        await this.recordRefreshFailure(undefined, context, 'INVALID_TOKEN');
        throw new RefreshTokenInvalidError();
      }

      const now = new Date();
      const ttlMs = this.getRefreshTtlMs();
      const result = await this.tokens.rotate(
        this.crypto.digest(rawToken),
        () => {
          const token = this.crypto.generate();
          return {
            token,
            tokenHash: this.crypto.digest(token),
            expiresAt: new Date(now.getTime() + ttlMs),
          };
        },
        now,
      );

      if (result.kind === 'INVALID') {
        await this.recordRefreshFailure(undefined, context, 'INVALID_TOKEN');
        throw new RefreshTokenInvalidError();
      }
      if (result.kind === 'EXPIRED') {
        await this.recordRefreshFailure(
          result.snapshot.userUuid,
          context,
          'EXPIRED',
        );
        await this.audit.record({
          action: 'REFRESH_TOKEN_REVOKED',
          actorUuid: result.snapshot.userUuid,
          subjectUuid: result.snapshot.userUuid,
          entityType: 'authentication_refresh_token',
          entityUuid: result.snapshot.id,
          result: 'SUCCESS',
          reason: 'EXPIRED',
          ...context,
        });
        throw new RefreshTokenExpiredError();
      }
      if (result.kind === 'REVOKED') {
        await this.recordRefreshFailure(
          result.snapshot.userUuid,
          context,
          'REVOKED',
        );
        throw new RefreshTokenRevokedError();
      }
      if (result.kind === 'REUSE_DETECTED') {
        this.observability.recordReuseDetected();
        this.observability.recordFamilyRevocation();
        const eventContext = {
          actorUuid: result.userUuid,
          subjectUuid: result.userUuid,
          ...context,
        };
        await this.audit.record({
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          entityType: 'authentication_refresh_token_family',
          entityUuid: result.familyId,
          result: 'FAILURE',
          reason: 'REUSE_DETECTED',
          ...eventContext,
        });
        await this.audit.record({
          action: 'REFRESH_TOKEN_FAMILY_REVOKED',
          entityType: 'authentication_refresh_token_family',
          entityUuid: result.familyId,
          result: 'SUCCESS',
          reason: 'REUSE_DETECTED',
          ...eventContext,
        });
        await this.audit.record({
          action: 'SESSION_REFRESH_REVOKED',
          entityType: 'session',
          entityUuid: result.sessionId,
          result: 'SUCCESS',
          reason: 'REUSE_DETECTED',
          ...eventContext,
        });
        await this.audit.record({
          action: 'REFRESH_FAILED',
          entityType: 'authentication_refresh_token',
          result: 'FAILURE',
          reason: 'REUSE_DETECTED',
          ...context,
          actorUuid: result.userUuid,
          subjectUuid: result.userUuid,
        });
        throw new RefreshTokenReuseDetectedError();
      }

      const accessToken = await this.jwt.issueAccessToken(
        result.value.userUuid,
        result.value.sessionId,
      );
      await this.audit.record({
        action: 'REFRESH_TOKEN_ROTATED',
        actorUuid: result.value.userUuid,
        subjectUuid: result.value.userUuid,
        entityType: 'authentication_refresh_token_family',
        entityUuid: result.value.familyId,
        result: 'SUCCESS',
        ...context,
      });
      successful = true;
      this.observability.recordSuccess();
      return {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshToken: result.value.newToken,
        refreshTokenExpiresIn: Math.max(
          1,
          Math.floor(
            (result.value.newTokenExpiresAt.getTime() - now.getTime()) / 1000,
          ),
        ),
      };
    } catch (error: unknown) {
      if (error instanceof RefreshTokenReuseDetectedError) {
        this.observability.recordFailure();
      } else if (
        error instanceof RefreshTokenInvalidError ||
        error instanceof RefreshTokenExpiredError ||
        error instanceof RefreshTokenRevokedError
      ) {
        this.observability.recordFailure();
      } else {
        this.observability.recordFailure();
        await this.recordRefreshFailure(undefined, context, 'INTERNAL_ERROR');
      }
      throw error;
    } finally {
      this.observability.finish(
        telemetry.span,
        telemetry.startedAt,
        successful,
      );
    }
  }

  getSessionExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + this.getRefreshTtlMs());
  }

  private async recordRefreshFailure(
    userUuid: string | undefined,
    context: RefreshRequestContext,
    reason: string,
  ): Promise<void> {
    await this.audit.record({
      action: 'REFRESH_FAILED',
      actorUuid: userUuid,
      subjectUuid: userUuid,
      entityType: 'authentication_refresh_token',
      result: 'FAILURE',
      reason,
      ...context,
    });
  }

  private getRefreshTtlMs(): number {
    const raw = this.config.getOrThrow<string>('auth.refreshToken.expiresIn');
    const match = /^(\d+)d$/.exec(raw);
    if (!match) throw new Error('Invalid refresh token configuration');
    return Number(match[1]) * 86400000;
  }
}
