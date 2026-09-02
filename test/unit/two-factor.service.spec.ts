import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { CredentialEntity } from '../../src/modules/users/credentials/domain/entities/credential.entity.js';
import type { UserRepository } from '../../src/modules/users/domain/repositories/user.repository.js';
import type { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';
import type { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { TotpService } from '../../src/modules/auth/application/services/totp.service.js';
import { TwoFactorCryptoService } from '../../src/modules/auth/application/services/two-factor-crypto.service.js';
import { TwoFactorService } from '../../src/modules/auth/application/services/two-factor.service.js';

const key = '01234567890123456789012345678901';

type TestCredentialRepository = ConstructorParameters<
  typeof TwoFactorService
>[5];
type EnrollmentResult = { enabled: boolean; recoveryCodes: string[] };

function createHarness() {
  let enabled = false;
  let encryptedSecret = '';
  let lockedUntil: Date | null = null;
  let lastStep: bigint | null = null;
  let recoveryHashes: { id: bigint; codeHash: string; used: boolean }[] = [];

  const repository = {
    findByUserUuid: vi.fn(() =>
      Promise.resolve({
        id: 1n,
        userUuid: 'u1',
        method: 'totp',
        secretEncrypted: encryptedSecret,
        enabledAt: enabled ? new Date() : null,
        lastUsedAt: null,
        lastUsedTimeStep: lastStep,
        enrollmentStartedAt: new Date(),
        failedVerificationAttempts: 0,
        lockedUntil,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    createPending: vi.fn(({ secretEncrypted }: { secretEncrypted: string }) => {
      encryptedSecret = secretEncrypted;
      lockedUntil = null;
      return Promise.resolve({} as never);
    }),
    enable: vi.fn(({ lastUsedTimeStep }: { lastUsedTimeStep: bigint }) => {
      enabled = true;
      lastStep = lastUsedTimeStep;
      lockedUntil = null;
      return Promise.resolve(true);
    }),
    disable: vi.fn(() => {
      enabled = false;
      encryptedSecret = '';
      lastStep = null;
      return Promise.resolve();
    }),
    recordFailedVerification: vi.fn(() => {
      lockedUntil = new Date(Date.now() + 900000);
      return Promise.resolve();
    }),
    recordSuccessfulVerification: vi.fn(
      ({ timeStep }: { timeStep: bigint }) => {
        if (lastStep !== null && timeStep <= lastStep)
          return Promise.resolve(false);
        lastStep = timeStep;
        lockedUntil = null;
        return Promise.resolve(true);
      },
    ),
  };

  const recovery = {
    replaceAll: vi.fn((_user: string, hashes: readonly string[]) => {
      recoveryHashes = hashes.map((codeHash, index) => ({
        id: BigInt(index + 1),
        codeHash,
        used: false,
      }));
      return Promise.resolve();
    }),
    findUnused: vi.fn(() =>
      Promise.resolve(
        recoveryHashes
          .filter((item) => !item.used)
          .map(({ id, codeHash }) => ({ id, codeHash })),
      ),
    ),
    markUsed: vi.fn((id: bigint) => {
      const item = recoveryHashes.find((entry) => entry.id === id);
      if (!item || item.used) return Promise.resolve(false);
      item.used = true;
      return Promise.resolve(true);
    }),
  };

  const enrollment = {
    enableWithRecoveryCodes: vi.fn(
      ({
        lastUsedTimeStep,
        recoveryCodeHashes,
      }: {
        lastUsedTimeStep: bigint;
        recoveryCodeHashes: readonly string[];
      }) => {
        enabled = true;
        lastStep = lastUsedTimeStep;
        lockedUntil = null;
        recoveryHashes = recoveryCodeHashes.map((codeHash, index) => ({
          id: BigInt(index + 1),
          codeHash,
          used: false,
        }));
        return Promise.resolve(true);
      },
    ),
  };

  const challenges = {
    create: vi.fn(() => Promise.resolve()),
    findByHash: vi.fn(() =>
      Promise.resolve({
        id: 1n,
        userUuid: 'u1',
        challengeHash: 'hash',
        expiresAt: new Date(Date.now() + 300000),
        consumedAt: null,
        failedAttempts: 0,
        createdAt: new Date(),
      }),
    ),
    recordFailure: vi.fn(() => Promise.resolve()),
    consume: vi.fn(() => Promise.resolve(true)),
  };

  const hasher = {
    hash: vi.fn((value: string) => Promise.resolve(`hash:${value}`)),
    verify: vi.fn((hash: string, value: string) =>
      Promise.resolve(hash === `hash:${value}`),
    ),
  };

  const jwt = {
    issueMfaChallenge: vi.fn(() => Promise.resolve('challenge')),
    verifyMfaChallenge: vi.fn(() =>
      Promise.resolve({
        sub: 'u1',
        challengeId: 'c',
        purpose: 'mfa-challenge' as const,
        iat: 1,
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ),
  };

  const audit = { record: vi.fn(() => Promise.resolve()) };

  const users = {
    findByUuid: vi.fn(() =>
      Promise.resolve({
        uuid: 'u1',
        email: 'user@example.com',
        username: 'user',
        status: 'active',
        isAccessible: () => true,
      }),
    ),
  };

  const credentials: TestCredentialRepository = {
    create: () => Promise.reject(new Error('unused in 2FA unit test')),
    findByUserUuid: () =>
      Promise.resolve(
        CredentialEntity.create({
          userUuid: 'u1',
          passwordHash: 'hash:password',
          passwordChangedAt: null,
          passwordExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
    updatePassword: () => Promise.reject(new Error('unused in 2FA unit test')),
    createResetToken: () =>
      Promise.reject(new Error('unused in 2FA unit test')),
    resetPasswordAtomically: () =>
      Promise.reject(new Error('unused in 2FA unit test')),
  };

  const config = new ConfigService({
    auth: {
      twoFactor: {
        encryptionKey: key,
        otpLockoutThreshold: 5,
        otpLockoutDurationMs: 900000,
        recoveryCodeCount: 3,
        challengeTtlMs: 300000,
        challengeMaxAttempts: 5,
      },
    },
    app: { name: 'estate-pro' },
  });
  const crypto = new TwoFactorCryptoService(config);
  const totp = new TotpService();
  const service = new TwoFactorService(
    repository,
    recovery,
    enrollment,
    challenges,
    users as unknown as UserRepository,
    credentials,
    audit,
    crypto,
    totp,
    jwt as unknown as JwtTokenService,
    hasher as unknown as PasswordHasherService,
    config,
  );

  const verifyEnrollment = async (
    userUuid: string,
    code: string,
  ): Promise<EnrollmentResult> =>
    await service.verifyEnrollment(userUuid, code);

  return { service, recovery, enrollment, totp, verifyEnrollment };
}

describe('2FA security flow', () => {
  it('encrypts the TOTP secret and recovers it without plaintext persistence', () => {
    const crypto = new TwoFactorCryptoService(
      new ConfigService({ auth: { twoFactor: { encryptionKey: key } } }),
    );
    const encrypted = crypto.encrypt('JBSWY3DPEHPK3PXP');
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(crypto.decrypt(encrypted)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('rejects invalid and expired TOTP values', () => {
    const totp = new TotpService();
    const secret = 'JBSWY3DPEHPK3PXP';
    const now = new Date('2026-08-25T10:00:15.000Z');
    const step = totp.currentTimeStep(now);
    const code = totp.generateCode(secret, step);
    expect(totp.verify(secret, code, now)).toBe(step);
    expect(totp.verify(secret, '000000', now)).toBeNull();
    expect(
      totp.verify(secret, code, new Date(now.getTime() + 30000)),
    ).toBeNull();
  });

  it('enables enrollment only after a valid code and blocks replay', async () => {
    const { service, totp, enrollment, verifyEnrollment } = createHarness();
    const enrollmentResult = await service.startEnrollment('u1');
    const secret = new URL(enrollmentResult.provisioningUri).searchParams.get(
      'secret',
    )!;
    const code = totp.generateCode(secret, totp.currentTimeStep());
    const result = await verifyEnrollment('u1', code);
    expect(result.enabled).toBe(true);
    expect(enrollment.enableWithRecoveryCodes).toHaveBeenCalledTimes(1);
    const challenge = await service.createLoginChallenge('u1');
    await expect(
      service.verifyLoginChallenge({ token: challenge.token, code }),
    ).rejects.toThrow();
  });

  it('hashes recovery codes and makes each code single-use', async () => {
    const { service, totp, enrollment, recovery, verifyEnrollment } =
      createHarness();
    const enrollmentResult = await service.startEnrollment('u1');
    const secret = new URL(enrollmentResult.provisioningUri).searchParams.get(
      'secret',
    )!;
    const code = totp.generateCode(secret, totp.currentTimeStep());
    const enabled = await verifyEnrollment('u1', code);
    expect(enabled.enabled).toBe(true);
    expect(enabled.recoveryCodes).toHaveLength(3);
    expect(enrollment.enableWithRecoveryCodes).toHaveBeenCalledTimes(1);

    const firstChallenge = await service.createLoginChallenge('u1');
    await service.verifyLoginChallenge({
      token: firstChallenge.token,
      recoveryCode: enabled.recoveryCodes[0],
    });
    expect(recovery.markUsed).toHaveBeenCalled();

    const secondChallenge = await service.createLoginChallenge('u1');
    await expect(
      service.verifyLoginChallenge({
        token: secondChallenge.token,
        recoveryCode: enabled.recoveryCodes[0],
      }),
    ).rejects.toThrow();
  });
});
