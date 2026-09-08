import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';

import { CredentialService } from '../../../src/modules/users/credentials/application/services/credential.service.js';
import {
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  ConcurrentPasswordChangeError,
  CurrentPasswordVerificationError,
  InvalidPasswordConfirmationError,
  InvalidPasswordError,
} from '../../../src/modules/users/credentials/domain/errors/credential.errors.js';
import { CredentialEntity } from '../../../src/modules/users/credentials/domain/entities/credential.entity.js';
import { PasswordPolicy } from '../../../src/modules/users/credentials/domain/policies/password.policy.js';
import { ConfiguredPasswordResetDeliveryService } from '../../../src/modules/users/credentials/application/services/configured-password-reset-delivery.service.js';
import { PasswordResetService } from '../../../src/modules/users/credentials/application/services/password-reset.service.js';
import { UserEntity } from '../../../src/modules/users/domain/entities/user.entity.js';
import { UserPublicAdapter } from '../../../src/modules/users/application/services/user-public.adapter.js';
import { UserProfileEntity } from '../../../src/modules/users/profile/domain/entities/user-profile.entity.js';
import { ProfileAuthenticationGuard } from '../../../src/modules/users/profile/security/profile-authentication.guard.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const userSnapshot = {
  uuid,
  username: 'jane',
  email: 'jane@example.com',
  phone: null,
  status: 'active',
  isActive: true,
  isVerified: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
} as const;

describe('users credentials and profile roadmap coverage', () => {
  it('covers password policy boundaries and credential errors', () => {
    const policy = new PasswordPolicy();
    expect(policy.validate('short1').valid).toBe(false);
    expect(policy.validate(`${'a'.repeat(128)}1`).valid).toBe(false);
    expect(policy.validate('\u0000abcdefghij1').valid).toBe(false);
    expect(policy.validate('            ').valid).toBe(false);
    expect(policy.validate('abcdefghijkl').valid).toBe(false);
    expect(policy.validate('password123').valid).toBe(false);
    expect(policy.validate('ValidPassword123').valid).toBe(true);
    expect(policy.validate('Ábcdefghijk1').valid).toBe(true);
    expect(() => policy.assertValid('bad')).toThrow();
    expect(() => policy.assertValid('ValidPassword123')).not.toThrow();
    expect(() => policy.assertConfirmation('abc', 'def')).toThrow();

    const errors = [
      new CredentialAlreadyExistsError(),
      new CredentialNotFoundError(),
      new ConcurrentPasswordChangeError(),
      new CurrentPasswordVerificationError(),
      new InvalidPasswordError(),
      new InvalidPasswordConfirmationError(),
    ];
    errors.forEach((error) => expect(error).toBeInstanceOf(Error));
  });

  it('covers credential entity lifecycle and service flows', async () => {
    const now = new Date();
    const entity = CredentialEntity.create({
      userUuid: uuid,
      passwordHash: 'hash',
      passwordChangedAt: now,
      passwordExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(entity.userUuid).toBe(uuid);
    expect(entity.passwordHash).toBe('hash');
    expect(entity.passwordChangedAt).toBe(now);
    expect(entity.passwordExpiresAt).toBeNull();
    expect(entity.toSnapshot().createdAt).toBe(now);
    expect(() =>
      CredentialEntity.create({
        userUuid: '',
        passwordHash: '',
        passwordChangedAt: null,
        passwordExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();

    const credentials = {
      findByUserUuid: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(undefined),
      updatePassword: vi.fn().mockResolvedValue(undefined),
    };
    const sessions = {
      revokeAllForSecurityEvent: vi.fn().mockResolvedValue(undefined),
    };
    const hasher = {
      hash: vi.fn().mockResolvedValue('hashed'),
      verify: vi.fn().mockResolvedValue(true),
    };
    const service = new CredentialService(
      credentials as never,
      sessions as never,
      hasher as never,
    );

    await expect(
      service.preparePasswordHash({
        password: 'ValidPassword123',
        confirmation: 'ValidPassword123',
      }),
    ).resolves.toBe('hashed');
    await expect(
      service.preparePasswordHash({ password: 'bad', confirmation: 'bad' }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
    await expect(
      service.preparePasswordHash({
        password: 'ValidPassword123',
        confirmation: 'different',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordConfirmationError);
    await expect(
      service.create({
        userUuid: uuid,
        password: 'ValidPassword123',
        confirmation: 'ValidPassword123',
      }),
    ).resolves.toBeUndefined();
    credentials.findByUserUuid.mockResolvedValueOnce({
      passwordHash: 'existing',
    });
    await expect(
      service.create({
        userUuid: uuid,
        password: 'ValidPassword123',
        confirmation: 'ValidPassword123',
      }),
    ).rejects.toBeInstanceOf(CredentialAlreadyExistsError);

    credentials.findByUserUuid.mockResolvedValueOnce(null);
    await expect(
      service.changePassword({
        userUuid: uuid,
        currentPassword: 'old',
        newPassword: 'ValidPassword123',
        confirmation: 'ValidPassword123',
      }),
    ).rejects.toBeInstanceOf(CredentialNotFoundError);
    credentials.findByUserUuid.mockResolvedValueOnce({
      passwordHash: 'old-hash',
    });
    hasher.verify.mockResolvedValueOnce(false);
    await expect(
      service.changePassword({
        userUuid: uuid,
        currentPassword: 'wrong',
        newPassword: 'ValidPassword123',
        confirmation: 'ValidPassword123',
      }),
    ).rejects.toBeInstanceOf(CurrentPasswordVerificationError);
    credentials.findByUserUuid.mockResolvedValueOnce({
      passwordHash: 'old-hash',
    });
    hasher.verify.mockResolvedValueOnce(true);
    credentials.updatePassword.mockRejectedValueOnce(
      new ConcurrentPasswordChangeError(),
    );
    await expect(
      service.changePassword({
        userUuid: uuid,
        currentPassword: 'old',
        newPassword: 'ValidPassword123',
        confirmation: 'ValidPassword123',
      }),
    ).rejects.toBeInstanceOf(ConcurrentPasswordChangeError);
    await expect(
      service.changePassword({
        userUuid: uuid,
        currentPassword: 'old',
        newPassword: 'ValidPassword123',
        confirmation: 'ValidPassword123',
        requestId: 'req',
      }),
    ).resolves.toBeUndefined();
    expect(sessions.revokeAllForSecurityEvent).toHaveBeenCalledWith(
      uuid,
      'PASSWORD_CHANGE',
      expect.objectContaining({ requestId: 'req' }),
    );
    expect(
      CredentialService.digestResetToken(
        CredentialService.generateResetToken(),
      ),
    ).toHaveLength(64);
  });

  it('covers user entity and public mapping lifecycle', async () => {
    const entity = UserEntity.create({ ...userSnapshot });
    expect(entity.isAccessible()).toBe(true);
    entity.update({ email: 'updated@example.com', phone: '08123' });
    expect(entity.email).toBe('updated@example.com');
    entity.softDelete(new Date('2026-02-01'));
    expect(entity.isAccessible()).toBe(false);
    expect(() =>
      UserEntity.create({ ...userSnapshot, uuid: 'invalid' }),
    ).toThrow('Invalid user UUID');
    expect(() =>
      UserEntity.create({
        ...userSnapshot,
        username: null,
        email: null,
        phone: null,
      }),
    ).toThrow('at least one identity');
    expect(() => UserEntity.create({ ...userSnapshot, status: '' })).toThrow(
      'Invalid user status',
    );

    const adapter = new UserPublicAdapter({
      getByUuid: vi.fn().mockResolvedValue(entity),
    } as never);
    await expect(adapter.getUser(uuid)).resolves.toMatchObject({
      uuid,
      status: 'inactive',
      isActive: false,
    });
  });

  it('covers profile entity validation and profile authentication boundaries', async () => {
    const now = new Date();
    const profile = UserProfileEntity.create({
      id: '1',
      userUuid: uuid,
      firstName: 'Jane',
      lastName: 'Doe',
      imageUrl: null,
      avatarThumbnailUrl: null,
      timezone: 'Asia/Jakarta',
      locale: 'id-ID',
      createdAt: now,
      updatedAt: now,
    });
    profile.update({ firstName: null, locale: 'en-US' });
    expect(profile.firstName).toBeNull();
    expect(() =>
      UserProfileEntity.create({ ...profile.toSnapshot(), id: 'x' }),
    ).toThrow('Invalid profile identifier');
    expect(() =>
      UserProfileEntity.create({
        ...profile.toSnapshot(),
        userUuid: 'invalid',
      }),
    ).toThrow('Invalid user UUID');
    expect(() =>
      UserProfileEntity.create({
        ...profile.toSnapshot(),
        firstName: 'x'.repeat(101),
      }),
    ).toThrow('Invalid firstName');
    expect(() =>
      UserProfileEntity.create({ ...profile.toSnapshot(), timezone: '' }),
    ).toThrow('Invalid timezone');
    expect(() =>
      UserProfileEntity.create({ ...profile.toSnapshot(), locale: 'english' }),
    ).toThrow('Invalid locale');

    const jwt = {
      verifyAccessToken: vi.fn().mockResolvedValue({
        sub: uuid,
        sid: 'session-1',
      }),
    };
    const sessions = { isActive: vi.fn().mockResolvedValue(true) };
    const users = {
      getByUuid: vi
        .fn()
        .mockResolvedValue(UserEntity.create({ ...userSnapshot })),
    };
    const guard = new ProfileAuthenticationGuard(
      jwt as never,
      sessions as never,
      users as never,
    );
    const request: {
      headers: { authorization: string };
      user?: unknown;
    } = { headers: { authorization: 'Bearer token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: uuid });
    const missingHeader = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(missingHeader)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    jwt.verifyAccessToken.mockRejectedValueOnce(new Error('invalid token'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    sessions.isActive.mockResolvedValueOnce(false);
    jwt.verifyAccessToken.mockResolvedValueOnce({
      sub: uuid,
      sid: 'session-2',
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('covers password reset request and reset branches', async () => {
    const users = { findByEmail: vi.fn().mockResolvedValue(null) };
    const credentials = {
      findByUserUuid: vi.fn(),
      createResetToken: vi.fn().mockResolvedValue(undefined),
      resetPasswordAtomically: vi.fn().mockResolvedValue(null),
    };
    const sessions = {
      revokeAllForSecurityEvent: vi.fn().mockResolvedValue(undefined),
    };
    const config = {
      getOrThrow: vi.fn().mockReturnValue(30),
    } as unknown as ConfigService;
    const hasher = { hash: vi.fn().mockResolvedValue('hash') };
    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetService(
      users as never,
      credentials as never,
      sessions as never,
      config,
      hasher as never,
      delivery,
    );

    await expect(service.requestByEmail('')).resolves.toEqual({
      accepted: true,
    });
    users.findByEmail.mockResolvedValueOnce(
      UserEntity.create({ ...userSnapshot, isActive: false }),
    );
    await expect(service.requestByEmail('jane@example.com')).resolves.toEqual({
      accepted: true,
    });
    users.findByEmail.mockResolvedValueOnce(
      UserEntity.create({ ...userSnapshot }),
    );
    credentials.findByUserUuid.mockResolvedValueOnce(null);
    await expect(service.requestByEmail('jane@example.com')).resolves.toEqual({
      accepted: true,
    });
    credentials.findByUserUuid.mockResolvedValueOnce({ passwordHash: 'hash' });
    await expect(service.requestByEmail('jane@example.com')).resolves.toEqual({
      accepted: true,
    });
    config.getOrThrow = vi.fn().mockReturnValue(0);
    credentials.findByUserUuid.mockResolvedValueOnce({ passwordHash: 'hash' });
    await expect(service.requestByEmail('jane@example.com')).rejects.toThrow(
      'Invalid password reset TTL',
    );
    config.getOrThrow = vi.fn().mockReturnValue(30);
    await expect(service.reset('token', 'bad', 'bad')).rejects.toThrow();
    await expect(
      service.reset('token', 'ValidPassword123', 'different'),
    ).rejects.toThrow('confirmation');
    await expect(
      service.reset('token', 'ValidPassword123', 'ValidPassword123'),
    ).rejects.toThrow('invalid or expired');
    credentials.resetPasswordAtomically.mockResolvedValueOnce(uuid);
    await expect(
      service.reset('token', 'ValidPassword123', 'ValidPassword123'),
    ).resolves.toBeUndefined();
  });

  it('covers configured reset delivery disabled, success and failure', async () => {
    const config = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new ConfiguredPasswordResetDeliveryService(config);
    const payload = {
      userUuid: uuid,
      token: 'token',
      expiresAt: new Date('2026-01-01'),
    };
    await expect(service.deliver(payload)).resolves.toBeUndefined();

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    config.get = vi.fn().mockReturnValue('https://example.com/reset');
    await expect(service.deliver(payload)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();

    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(service.deliver(payload)).rejects.toThrow('status 503');
    vi.unstubAllGlobals();

    config.get = vi.fn().mockReturnValue('http://127.0.0.1:4000/reset');
    await expect(service.deliver(payload)).rejects.toBeInstanceOf(Error);
  });
});
