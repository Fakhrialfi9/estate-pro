import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { TotpService } from '../../src/modules/auth/application/services/totp.service.js';
import { TwoFactorCryptoService } from '../../src/modules/auth/application/services/two-factor-crypto.service.js';
import { TwoFactorService } from '../../src/modules/auth/application/services/two-factor.service.js';

const key = '01234567890123456789012345678901';

function createHarness() {
  let enabled = false;
  let encryptedSecret = '';
  let lockedUntil: Date | null = null;
  let lastStep: bigint | null = null;
  let recoveryHashes: { id: bigint; codeHash: string; used: boolean }[] = [];
  let challengeConsumed = false;
  const repository = {
    findByUserUuid: vi.fn(async () => ({ id: 1n, userUuid: 'u1', method: 'totp', secretEncrypted: encryptedSecret, enabledAt: enabled ? new Date() : null, lastUsedAt: null, lastUsedTimeStep: lastStep, enrollmentStartedAt: new Date(), failedVerificationAttempts: 0, lockedUntil, createdAt: new Date(), updatedAt: new Date() })),
    createPending: vi.fn(async ({ secretEncrypted }: { secretEncrypted: string }) => { encryptedSecret = secretEncrypted; lockedUntil = null; }),
    enable: vi.fn(async ({ lastUsedTimeStep }: { lastUsedTimeStep: bigint }) => { enabled = true; lastStep = lastUsedTimeStep; lockedUntil = null; return true; }),
    disable: vi.fn(async () => { enabled = false; encryptedSecret = ''; lastStep = null; }),
    recordFailedVerification: vi.fn(async () => { lockedUntil = new Date(Date.now() + 900000); }),
    recordSuccessfulVerification: vi.fn(async ({ timeStep }: { timeStep: bigint }) => { if (lastStep !== null && timeStep <= lastStep) return false; lastStep = timeStep; lockedUntil = null; return true; }),
  };
  const recovery = {
    replaceAll: vi.fn(async (_user: string, hashes: readonly string[]) => { recoveryHashes = hashes.map((codeHash, index) => ({ id: BigInt(index + 1), codeHash, used: false })); }),
    findUnused: vi.fn(async () => recoveryHashes.filter((item) => !item.used).map(({ id, codeHash }) => ({ id, codeHash }))),
    markUsed: vi.fn(async (id: bigint) => { const item = recoveryHashes.find((entry) => entry.id === id); if (!item || item.used) return false; item.used = true; return true; }),
  };
  const challenges = {
    create: vi.fn(async () => undefined),
    findByHash: vi.fn(async () => ({ id: 1n, userUuid: 'u1', challengeHash: 'hash', expiresAt: new Date(Date.now() + 300000), consumedAt: challengeConsumed ? new Date() : null, failedAttempts: 0, createdAt: new Date() })),
    recordFailure: vi.fn(async () => undefined),
    consume: vi.fn(async () => { if (challengeConsumed) return false; challengeConsumed = true; return true; }),
  };
  const hasher = { hash: vi.fn(async (value: string) => `hash:${value}`), verify: vi.fn(async (hash: string, value: string) => hash === `hash:${value}`) };
  const jwt = { issueMfaChallenge: vi.fn(async () => 'challenge'), verifyMfaChallenge: vi.fn(async () => ({ sub: 'u1', challengeId: 'c', purpose: 'mfa-challenge' as const, iat: 1, exp: Math.floor(Date.now() / 1000) + 300 })) };
  const audit = { record: vi.fn(async () => undefined) };
  const users = { findByUuid: vi.fn(async () => ({ uuid: 'u1', email: 'user@example.com', username: 'user', status: 'active', isAccessible: () => true })) };
  const credentials = { findByUserUuid: vi.fn(async () => ({ passwordHash: 'hash:password' })) };
  const config = new ConfigService({ auth: { twoFactor: { otpLockoutThreshold: 5, otpLockoutDurationMs: 900000, recoveryCodeCount: 3, challengeTtlMs: 300000, challengeMaxAttempts: 5 } }, app: { name: 'estate-pro' } });
  const crypto = new TwoFactorCryptoService(config);
  const totp = new TotpService();
  const service = new TwoFactorService(repository as any, recovery as any, challenges as any, users as any, credentials as any, audit as any, crypto, totp, jwt as any, hasher as any, config);
  return { service, repository, recovery, challenges, crypto, totp };
}

describe('2FA security flow', () => {
  it('encrypts the TOTP secret and recovers it without plaintext persistence', () => {
    const crypto = new TwoFactorCryptoService(new ConfigService({ auth: { twoFactor: { encryptionKey: key } } }));
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
    expect(totp.verify(secret, code, new Date(now.getTime() + 30000))).toBeNull();
  });

  it('enables enrollment only after a valid code and blocks replay', async () => {
    const { service, totp } = createHarness();
    const enrollment = await service.startEnrollment('u1');
    const secret = new URL(enrollment.provisioningUri).searchParams.get('secret')!;
    const code = totp.generateCode(secret, totp.currentTimeStep());
    const result = await service.verifyEnrollment('u1', code);
    expect(result.enabled).toBe(true);
    const challenge = await service.createLoginChallenge('u1');
    await expect(service.verifyLoginChallenge({ token: challenge.token, code })).rejects.toThrow();
  });

  it('hashes recovery codes and makes each code single-use', async () => {
    const { service, totp, recovery } = createHarness();
    const enrollment = await service.startEnrollment('u1');
    const secret = new URL(enrollment.provisioningUri).searchParams.get('secret')!;
    const code = totp.generateCode(secret, totp.currentTimeStep());
    const enabled = await service.verifyEnrollment('u1', code);
    expect(enabled.recoveryCodes).toHaveLength(3);
    expect(recovery.replaceAll).toHaveBeenCalledWith('u1', expect.arrayContaining([expect.stringMatching(/^hash:/)]));
    const challenge = await service.createLoginChallenge('u1');
    await service.verifyLoginChallenge({ token: challenge.token, recoveryCode: enabled.recoveryCodes[0] });
    expect(recovery.markUsed).toHaveBeenCalled();
  });
});
