import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';
import { CredentialService } from '../../src/modules/users/credentials/application/services/credential.service.js';
import { PasswordPolicy } from '../../src/modules/users/credentials/domain/policies/password.policy.js';
import { CurrentPasswordVerificationError } from '../../src/modules/users/credentials/domain/errors/credential.errors.js';
import type { CredentialRepository } from '../../src/modules/users/credentials/domain/repositories/credential.repository.js';
import { PasswordResetService } from '../../src/modules/users/credentials/application/services/password-reset.service.js';
import type { UserRepository } from '../../src/modules/users/domain/repositories/user.repository.js';

const userUuid = '7d3f5e3a-a0ee-4ed7-9f02-0c9a2f0e1b11';
const passwordConfig = {
  getOrThrow: (key: string) =>
    key === 'auth.passwordHashing'
      ? { memoryCost: 19456, timeCost: 2, parallelism: 1, hashLength: 32 }
      : key === 'auth.passwordReset.tokenTtlMinutes'
        ? 15
        : undefined,
};

describe('credential security', () => {
  it('enforces a practical password policy and confirmation', () => {
    const policy = new PasswordPolicy();
    expect(policy.validate('short1A')).toEqual(
      expect.objectContaining({ valid: false }),
    );
    expect(policy.validate('SecurePassword123')).toEqual({ valid: true });
    expect(policy.validate('123456789012')).toEqual(
      expect.objectContaining({ valid: false }),
    );
    expect(() =>
      policy.assertConfirmation('SecurePassword123', 'SecurePassword124'),
    ).toThrow();
  });

  it('hashes with Argon2id, verifies securely, and detects invalid passwords', async () => {
    const hasher = new PasswordHasherService(
      passwordConfig as unknown as ConfigService,
    );
    const password = 'SecurePassword123';
    const hash = await hasher.hash(password);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toBe(password);
    expect(await hasher.verify(hash, password)).toBe(true);
    expect(await hasher.verify(hash, 'WrongPassword123')).toBe(false);
    expect(hasher.needsRehash(hash)).toBe(false);
  });

  it('creates credentials without returning password material', async () => {
    const repository = {
      findByUserUuid: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ passwordHash: 'hash' }),
    } as unknown as CredentialRepository;
    const hasher = {
      hash: vi.fn().mockResolvedValue('argon2-hash'),
    } as unknown as PasswordHasherService;
    const service = new CredentialService(repository, hasher);

    await expect(
      service.create({
        userUuid,
        password: 'SecurePassword123',
        confirmation: 'SecurePassword123',
      }),
    ).resolves.toBeUndefined();
    expect(repository.create).toHaveBeenCalledWith(userUuid, 'argon2-hash');
  });

  it('changes password only after current-password verification and never returns a hash', async () => {
    const repository = {
      findByUserUuid: vi
        .fn()
        .mockResolvedValue({ userUuid, passwordHash: 'old-hash' }),
      updatePassword: vi.fn().mockResolvedValue(undefined),
    } as unknown as CredentialRepository;
    const hasher = {
      verify: vi.fn().mockResolvedValue(true),
      hash: vi.fn().mockResolvedValue('new-argon2-hash'),
    } as unknown as PasswordHasherService;
    const service = new CredentialService(repository, hasher);

    await expect(
      service.changePassword({
        userUuid,
        currentPassword: 'CurrentPassword123',
        newPassword: 'NewSecurePassword123',
        confirmation: 'NewSecurePassword123',
      }),
    ).resolves.toBeUndefined();
    expect(repository.updatePassword).toHaveBeenCalledWith(
      userUuid,
      'new-argon2-hash',
      expect.any(Date),
    );

    vi.mocked(hasher.verify).mockResolvedValue(false);
    await expect(
      service.changePassword({
        userUuid,
        currentPassword: 'WrongPassword123',
        newPassword: 'NewSecurePassword123',
        confirmation: 'NewSecurePassword123',
      }),
    ).rejects.toBeInstanceOf(CurrentPasswordVerificationError);
    expect(repository.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('generates high-entropy reset tokens and persists only their digest', () => {
    const token = CredentialService.generateResetToken();
    const digest = CredentialService.digestResetToken(token);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(token);
  });

  it('keeps reset requests generic for existing and non-existing identities', async () => {
    const user = { uuid: userUuid, isAccessible: () => true };
    const users = { findByEmail: vi.fn() } as unknown as UserRepository;
    const credentials = {
      findByUserUuid: vi
        .fn()
        .mockResolvedValue({ userUuid, passwordHash: 'hash' }),
      createResetToken: vi.fn().mockResolvedValue(undefined),
    } as unknown as CredentialRepository;
    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetService(
      users,
      credentials,
      passwordConfig as unknown as ConfigService,
      { hash: vi.fn() } as unknown as PasswordHasherService,
      delivery,
    );

    vi.mocked(users.findByEmail).mockResolvedValue(null);
    await expect(
      service.requestByEmail('missing@example.com'),
    ).resolves.toEqual({ accepted: true });
    expect(credentials.createResetToken).not.toHaveBeenCalled();

    vi.mocked(users.findByEmail).mockResolvedValue(user as never);
    await expect(service.requestByEmail('member@example.com')).resolves.toEqual(
      { accepted: true },
    );
    expect(credentials.createResetToken).toHaveBeenCalledWith(
      userUuid,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(delivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ token: expect.any(String) }),
    );
  });

  it('uses the repository atomic reset contract and rejects token replay', async () => {
    const credentials = {
      resetPasswordAtomically: vi
        .fn()
        .mockResolvedValueOnce(userUuid)
        .mockResolvedValueOnce(null),
    } as unknown as CredentialRepository;
    const users = {} as UserRepository;
    const hasher = {
      hash: vi.fn().mockResolvedValue('new-argon2-hash'),
    } as unknown as PasswordHasherService;
    const delivery = { deliver: vi.fn() };
    const service = new PasswordResetService(
      users,
      credentials,
      passwordConfig as unknown as ConfigService,
      hasher,
      delivery,
    );
    const token = CredentialService.generateResetToken();

    await expect(
      service.reset(token, 'ResetSecurePassword123', 'ResetSecurePassword123'),
    ).resolves.toBeUndefined();
    await expect(
      service.reset(token, 'ResetSecurePassword123', 'ResetSecurePassword123'),
    ).rejects.toThrow('Password reset token is invalid or expired');
    expect(credentials.resetPasswordAtomically).toHaveBeenCalledTimes(2);
    expect(credentials.resetPasswordAtomically.mock.calls[0]).toEqual([
      CredentialService.digestResetToken(token),
      'new-argon2-hash',
      expect.any(Date),
    ]);
  });
});
