import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
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
import { TotpService } from './totp.service.js';
import { TwoFactorCryptoService } from './two-factor-crypto.service.js';
import type { SecurityAuditRepository } from '../../domain/repositories/security-audit.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../domain/repositories/security-audit.repository.js';
import type { TwoFactorRepository } from '../../domain/repositories/two-factor.repository.js';
import { TWO_FACTOR_REPOSITORY } from '../../domain/repositories/two-factor.repository.js';
import type { TwoFactorRecoveryCodeRepository } from '../../domain/repositories/two-factor-recovery-code.repository.js';
import { TWO_FACTOR_RECOVERY_CODE_REPOSITORY } from '../../domain/repositories/two-factor-recovery-code.repository.js';
import type { TwoFactorChallengeRepository } from '../../domain/repositories/two-factor-challenge.repository.js';
import { TWO_FACTOR_CHALLENGE_REPOSITORY } from '../../domain/repositories/two-factor-challenge.repository.js';

export interface TwoFactorAuditContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}
export const TWO_FACTOR_AUDIT_ACTIONS = {
  ENROLLMENT: '2FA_ENROLLMENT',
  ENABLED: '2FA_ENABLED',
  DISABLED: '2FA_DISABLED',
  RECOVERY_CODE_USED: '2FA_RECOVERY_CODE_USED',
  RECOVERY_CODES_REGENERATED: '2FA_RECOVERY_CODES_REGENERATED',
} as const;

@Injectable()
export class TwoFactorService {
  constructor(
    @Inject(TWO_FACTOR_REPOSITORY)
    private readonly repository: TwoFactorRepository,
    @Inject(TWO_FACTOR_RECOVERY_CODE_REPOSITORY)
    private readonly recoveryCodes: TwoFactorRecoveryCodeRepository,
    @Inject(TWO_FACTOR_CHALLENGE_REPOSITORY)
    private readonly challenges: TwoFactorChallengeRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly crypto: TwoFactorCryptoService,
    private readonly totp: TotpService,
    private readonly jwt: JwtTokenService,
    private readonly hasher: PasswordHasherService,
    private readonly config: ConfigService,
  ) {}

  async isEnabled(userUuid: string): Promise<boolean> {
    const snapshot = await this.repository.findByUserUuid(userUuid);
    return Boolean(snapshot?.enabledAt);
  }

  async startEnrollment(userUuid: string, context: TwoFactorAuditContext = {}) {
    const existing = await this.repository.findByUserUuid(userUuid);
    if (existing?.enabledAt)
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    const user = await this.users.findByUuid(userUuid);
    if (!user) throw new UnauthorizedException();
    const secret = this.totp.generateSecret();
    await this.repository.createPending({
      userUuid,
      secretEncrypted: this.crypto.encrypt(secret),
      startedAt: new Date(),
    });
    await this.audit.record({
      action: TWO_FACTOR_AUDIT_ACTIONS.ENROLLMENT,
      userUuid,
      ...context,
    });
    return {
      method: 'totp' as const,
      provisioningUri: this.totp.provisioningUri({
        secret,
        accountName: user.email ?? user.username ?? user.uuid,
        issuer: this.config.get<string>('app.name') ?? 'estate-pro-api',
      }),
      verificationRequired: true as const,
    };
  }

  async verifyEnrollment(
    userUuid: string,
    code: string,
    context: TwoFactorAuditContext = {},
  ): Promise<{ enabled: true; recoveryCodes: string[] }> {
    const snapshot = await this.repository.findByUserUuid(userUuid);
    if (!snapshot || snapshot.enabledAt)
      throw new BadRequestException('Two-factor enrollment is not pending');
    const now = new Date();
    if (snapshot.lockedUntil && snapshot.lockedUntil > now)
      throw new UnauthorizedException('Verification temporarily locked');
    const timeStep = this.totp.verify(
      this.crypto.decrypt(snapshot.secretEncrypted),
      code,
      now,
    );
    if (timeStep === null) {
      await this.recordFailure(userUuid, now);
      throw new UnauthorizedException('Invalid verification code');
    }
    if (
      !(await this.repository.enable({
        userUuid,
        enabledAt: now,
        lastUsedAt: now,
        lastUsedTimeStep: timeStep,
      }))
    )
      throw new UnauthorizedException('Invalid verification code');
    const recoveryCodes = await this.issueRecoveryCodes(userUuid);
    await this.audit.record({
      action: TWO_FACTOR_AUDIT_ACTIONS.ENABLED,
      userUuid,
      ...context,
    });
    return { enabled: true, recoveryCodes };
  }

  async createLoginChallenge(
    userUuid: string,
  ): Promise<{ token: string; expiresIn: number }> {
    const challengeId = randomBytes(32).toString('base64url');
    const expiresIn = this.config.get<number>(
      'auth.twoFactor.challengeTtlMs',
      300000,
    );
    await this.challenges.create({
      userUuid,
      challengeHash: this.digest(challengeId),
      expiresAt: new Date(Date.now() + expiresIn),
    });
    return {
      token: await this.jwt.issueMfaChallenge(userUuid, challengeId),
      expiresIn: Math.floor(expiresIn / 1000),
    };
  }

  async verifyLoginChallenge(input: {
    token: string;
    code?: string;
    recoveryCode?: string;
    context?: TwoFactorAuditContext;
  }): Promise<string> {
    const claims = await this.jwt.verifyMfaChallenge(input.token);
    const challenge = await this.challenges.findByHash(
      this.digest(claims.challengeId),
    );
    const now = new Date();
    if (
      !challenge ||
      challenge.userUuid !== claims.sub ||
      challenge.consumedAt ||
      challenge.expiresAt <= now
    )
      throw new UnauthorizedException(
        'Invalid or expired two-factor challenge',
      );
    if (
      challenge.failedAttempts >=
      this.config.get<number>('auth.twoFactor.challengeMaxAttempts', 5)
    )
      throw new UnauthorizedException(
        'Two-factor challenge temporarily locked',
      );
    const snapshot = await this.repository.findByUserUuid(challenge.userUuid);
    if (!snapshot?.enabledAt)
      throw new UnauthorizedException(
        'Two-factor authentication is not enabled',
      );
    let verified = false;
    if (input.recoveryCode) {
      verified = await this.consumeRecoveryCode(
        challenge.userUuid,
        input.recoveryCode,
      );
      if (verified)
        await this.audit.record({
          action: TWO_FACTOR_AUDIT_ACTIONS.RECOVERY_CODE_USED,
          userUuid: challenge.userUuid,
          ...input.context,
        });
    } else if (input.code) {
      if (snapshot.lockedUntil && snapshot.lockedUntil > now)
        throw new UnauthorizedException('Verification temporarily locked');
      const step = this.totp.verify(
        this.crypto.decrypt(snapshot.secretEncrypted),
        input.code,
        now,
      );
      if (step !== null)
        verified = await this.repository.recordSuccessfulVerification({
          userUuid: challenge.userUuid,
          now,
          timeStep: step,
        });
    }
    if (!verified) {
      await this.challenges.recordFailure(challenge.id);
      await this.recordFailure(challenge.userUuid, now);
      throw new UnauthorizedException('Invalid two-factor verification code');
    }
    if (!(await this.challenges.consume(challenge.id, now)))
      throw new UnauthorizedException('Two-factor challenge already used');
    return challenge.userUuid;
  }

  async regenerateRecoveryCodes(
    userUuid: string,
    password: string,
    code: string,
    context: TwoFactorAuditContext = {},
  ): Promise<{ recoveryCodes: string[] }> {
    const credential = await this.credentials.findByUserUuid(userUuid);
    if (
      !credential ||
      !(await this.hasher.verify(credential.passwordHash, password))
    )
      throw new UnauthorizedException('Re-authentication failed');
    const snapshot = await this.repository.findByUserUuid(userUuid);
    if (
      !snapshot?.enabledAt ||
      (snapshot.lockedUntil && snapshot.lockedUntil > new Date())
    )
      throw new UnauthorizedException('Re-authentication failed');
    const step = this.totp.verify(
      this.crypto.decrypt(snapshot.secretEncrypted),
      code,
    );
    if (
      step === null ||
      !(await this.repository.recordSuccessfulVerification({
        userUuid,
        now: new Date(),
        timeStep: step,
      }))
    )
      throw new UnauthorizedException('Re-authentication failed');
    const recoveryCodes = await this.issueRecoveryCodes(userUuid);
    await this.audit.record({
      action: TWO_FACTOR_AUDIT_ACTIONS.RECOVERY_CODES_REGENERATED,
      userUuid,
      ...context,
    });
    return { recoveryCodes };
  }

  async disable(
    userUuid: string,
    password: string,
    code?: string,
    recoveryCode?: string,
    context: TwoFactorAuditContext = {},
  ): Promise<void> {
    const credential = await this.credentials.findByUserUuid(userUuid);
    if (
      !credential ||
      !(await this.hasher.verify(credential.passwordHash, password))
    )
      throw new UnauthorizedException('Re-authentication failed');
    let verified = false;
    if (code) {
      const snapshot = await this.repository.findByUserUuid(userUuid);
      if (snapshot?.enabledAt) {
        const step = this.totp.verify(
          this.crypto.decrypt(snapshot.secretEncrypted),
          code,
        );
        if (step !== null)
          verified = await this.repository.recordSuccessfulVerification({
            userUuid,
            now: new Date(),
            timeStep: step,
          });
      }
    } else if (recoveryCode) {
      verified = await this.consumeRecoveryCode(userUuid, recoveryCode);
      if (verified)
        await this.audit.record({
          action: TWO_FACTOR_AUDIT_ACTIONS.RECOVERY_CODE_USED,
          userUuid,
          ...context,
        });
    }
    if (!verified) throw new UnauthorizedException('Re-authentication failed');
    await this.repository.disable(userUuid);
    await this.recoveryCodes.replaceAll(userUuid, []);
    await this.audit.record({
      action: TWO_FACTOR_AUDIT_ACTIONS.DISABLED,
      userUuid,
      ...context,
    });
  }

  private async recordFailure(userUuid: string, now: Date): Promise<void> {
    await this.repository.recordFailedVerification({
      userUuid,
      now,
      threshold: this.config.get<number>(
        'auth.twoFactor.otpLockoutThreshold',
        5,
      ),
      lockDurationMs: this.config.get<number>(
        'auth.twoFactor.otpLockoutDurationMs',
        900000,
      ),
    });
  }

  private async consumeRecoveryCode(
    userUuid: string,
    input: string,
  ): Promise<boolean> {
    const normalized = input.trim().replace(/\s/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(normalized)) return false;
    const candidates = await this.recoveryCodes.findUnused(userUuid);
    for (const candidate of candidates) {
      if (await this.hasher.verify(candidate.codeHash, normalized))
        return this.recoveryCodes.markUsed(candidate.id, new Date());
    }
    return false;
  }

  private async issueRecoveryCodes(userUuid: string): Promise<string[]> {
    const count = this.config.get<number>(
      'auth.twoFactor.recoveryCodeCount',
      10,
    );
    const codes = Array.from({ length: count }, () =>
      randomBytes(16).toString('hex'),
    );
    const hashes: string[] = [];
    for (const code of codes) hashes.push(await this.hasher.hash(code));
    await this.recoveryCodes.replaceAll(userUuid, hashes);
    return codes;
  }

  private digest(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }
}
