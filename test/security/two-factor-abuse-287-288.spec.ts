import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TwoFactorService } from '../../src/modules/auth/application/services/two-factor.service.js';
import { TwoFactorCryptoService } from '../../src/modules/auth/application/services/two-factor-crypto.service.js';
import { TotpService } from '../../src/modules/auth/application/services/totp.service.js';

const USER_UUID = '7e9d9c67-30a5-4d2c-a8df-70755f96ad35';
const ENCRYPTION_KEY = '01234567890123456789012345678901';
const RECOVERY_CODE = 'abcdef0123456789abcdef0123456789';

function createHarness() {
  const config = new ConfigService({
    app: { name: 'estate-pro' },
    auth: {
      twoFactor: {
        encryptionKey: ENCRYPTION_KEY,
        challengeTtlMs: 300000,
        challengeMaxAttempts: 5,
        otpLockoutThreshold: 5,
        otpLockoutDurationMs: 900000,
        recoveryCodeCount: 1,
      },
    },
  });
  const crypto = new TwoFactorCryptoService(config);
  let failedAttempts = 0;
  const challenges = {
    create: vi.fn(),
    findByHash: vi.fn(() =>
      Promise.resolve({
        id: 1n,
        userUuid: USER_UUID,
        challengeHash: 'challenge-hash',
        expiresAt: new Date(Date.now() + 300000),
        consumedAt: null,
        failedAttempts,
        createdAt: new Date(),
      }),
    ),
    recordFailure: vi.fn(() => {
      failedAttempts += 1;
      return Promise.resolve();
    }),
    consume: vi.fn(() => Promise.resolve(true)),
  };
  let recoveryUsed = false;
  const recovery = {
    findUnused: vi.fn(() =>
      Promise.resolve(
        recoveryUsed ? [] : [{ id: 1n, codeHash: `hash:${RECOVERY_CODE}` }],
      ),
    ),
    markUsed: vi.fn(() => {
      if (recoveryUsed) return Promise.resolve(false);
      recoveryUsed = true;
      return Promise.resolve(true);
    }),
    replaceAll: vi.fn(),
  };
  const repository = {
    findByUserUuid: vi.fn(() =>
      Promise.resolve({
        id: 1n,
        userUuid: USER_UUID,
        method: 'totp',
        secretEncrypted: crypto.encrypt('JBSWY3DPEHPK3PXP'),
        enabledAt: new Date(),
        lastUsedAt: null,
        lastUsedTimeStep: null,
        enrollmentStartedAt: null,
        failedVerificationAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    recordFailedVerification: vi.fn(() => Promise.resolve()),
    recordSuccessfulVerification: vi.fn(() => Promise.resolve(true)),
  };
  const enrollment = {
    createPending: vi.fn(),
    enableWithRecoveryCodes: vi.fn(),
  };
  const users = {
    findByUuid: vi.fn(() =>
      Promise.resolve({
        uuid: USER_UUID,
        email: 'user@example.com',
        username: 'user',
        status: 'active',
        isAccessible: () => true,
      }),
    ),
  };
  const credentials = { findByUserUuid: vi.fn() };
  const jwt = {
    verifyMfaChallenge: vi.fn(() =>
      Promise.resolve({
        sub: USER_UUID,
        challengeId: 'challenge-id',
        purpose: 'mfa-challenge' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ),
  };
  const hasher = {
    hash: vi.fn((value: string) => Promise.resolve(`hash:${value}`)),
    verify: vi.fn((hash: string, value: string) =>
      Promise.resolve(hash === `hash:${value}`),
    ),
  };
  const audit = { record: vi.fn(() => Promise.resolve()) };
  const service = new TwoFactorService(
    repository as never,
    recovery,
    enrollment,
    challenges,
    users as never,
    credentials as never,
    audit,
    crypto,
    new TotpService(),
    jwt as never,
    hasher as never,
    config,
  );
  return { service, challenges, recovery };
}

describe('STEP 287 — OTP brute force', () => {
  it('locks the MFA challenge after repeated invalid OTP attempts', async () => {
    const { service, challenges } = createHarness();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.verifyLoginChallenge({ token: 'challenge', code: '000000' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    expect(challenges.recordFailure).toHaveBeenCalledTimes(5);
    await expect(
      service.verifyLoginChallenge({ token: 'challenge', code: '000000' }),
    ).rejects.toThrow('Two-factor challenge temporarily locked');
    expect(challenges.recordFailure).toHaveBeenCalledTimes(5);
  });
});

describe('STEP 288 — recovery code abuse', () => {
  it('consumes a recovery code once and rejects replay', async () => {
    const { service, recovery } = createHarness();

    await expect(
      service.verifyLoginChallenge({
        token: 'challenge',
        recoveryCode: RECOVERY_CODE,
      }),
    ).resolves.toBe(USER_UUID);

    await expect(
      service.verifyLoginChallenge({
        token: 'challenge',
        recoveryCode: RECOVERY_CODE,
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(recovery.markUsed).toHaveBeenCalledOnce();
  });
});
