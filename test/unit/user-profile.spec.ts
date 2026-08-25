import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';

import { UserProfileEntity } from '../../src/modules/users/profile/domain/entities/user-profile.entity.js';
import {
  DuplicateUserProfileError,
  InvalidUserProfileError,
  UserProfileAccessDeniedError,
  UserProfileNotFoundError,
} from '../../src/modules/users/profile/domain/errors/user-profile.errors.js';
import { UserProfileOwnershipPolicy } from '../../src/modules/users/profile/application/policies/user-profile-ownership.policy.js';
import { UserProfileService } from '../../src/modules/users/profile/application/services/user-profile.service.js';
import { CreateUserProfileDto } from '../../src/modules/users/profile/application/dto/create-user-profile.dto.js';
import { UpdateUserProfileDto } from '../../src/modules/users/profile/application/dto/update-user-profile.dto.js';
import { serializeUserProfile } from '../../src/modules/users/profile/application/serializers/user-profile.serializer.js';
import { PrismaUserProfileMapper } from '../../src/modules/users/profile/infrastructure/persistence/prisma-user-profile.mapper.js';
import { USER_PROFILE_TRANSACTION_POLICY } from '../../src/modules/users/profile/application/transaction-policy.js';
import { UserNotFoundError } from '../../src/modules/users/domain/errors/user.errors.js';

type ProfileRepositoryMock = {
  create: ReturnType<typeof vi.fn>;
  findByUserUuid: ReturnType<typeof vi.fn>;
  updateByUserUuid: ReturnType<typeof vi.fn>;
};

const userUuid = '00000000-0000-4000-8000-000000000001';
const otherUuid = '00000000-0000-4000-8000-000000000002';

const profile = () =>
  UserProfileEntity.create({
    id: '42',
    userUuid,
    firstName: 'Muhammad',
    lastName: 'Fakhri',
    imageUrl: null,
    avatarThumbnailUrl: null,
    timezone: 'Asia/Jakarta',
    locale: 'id',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

const createService = () => {
  const repository: ProfileRepositoryMock = {
    create: vi.fn().mockResolvedValue(profile()),
    findByUserUuid: vi.fn().mockResolvedValue(null),
    updateByUserUuid: vi.fn().mockResolvedValue(profile()),
  };
  const users = {
    getByUuid: vi.fn().mockResolvedValue({ isAccessible: () => true }),
  };
  const service = new UserProfileService(
    repository as never,
    users as never,
    new UserProfileOwnershipPolicy(),
  );
  return { service, repository, users };
};

describe('UserProfile domain and application', () => {
  it('creates a profile successfully', async () => {
    const { service } = createService();
    await expect(
      service.create({ sub: userUuid }, userUuid, { firstName: 'Muhammad' }),
    ).resolves.toBeInstanceOf(UserProfileEntity);
  });

  it('rejects invalid profile input', async () => {
    const { service } = createService();
    await expect(
      service.create({ sub: userUuid }, userUuid, {
        firstName: 'x'.repeat(101),
      }),
    ).rejects.toBeInstanceOf(InvalidUserProfileError);
  });

  it('rejects an invalid user identity', async () => {
    const { service, users } = createService();
    users.getByUuid.mockRejectedValueOnce(new UserNotFoundError());
    await expect(
      service.create({ sub: userUuid }, userUuid, { firstName: 'Test' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('rejects duplicate profiles', async () => {
    const { service, repository } = createService();
    repository.findByUserUuid.mockResolvedValueOnce(profile());
    await expect(
      service.create({ sub: userUuid }, userUuid, { firstName: 'Test' }),
    ).rejects.toBeInstanceOf(DuplicateUserProfileError);
  });

  it('reads a profile successfully', async () => {
    const { service, repository } = createService();
    const expected = profile();
    repository.findByUserUuid.mockResolvedValueOnce(expected);
    await expect(service.get({ sub: userUuid }, userUuid)).resolves.toBe(expected);
  });

  it('handles profile not found', async () => {
    const { service } = createService();
    await expect(
      service.get({ sub: userUuid }, userUuid),
    ).rejects.toBeInstanceOf(UserProfileNotFoundError);
  });

  it('updates a profile successfully', async () => {
    const { service, repository } = createService();
    repository.findByUserUuid.mockResolvedValueOnce(profile());
    await expect(
      service.update({ sub: userUuid }, userUuid, { firstName: 'Updated' }),
    ).resolves.toBeInstanceOf(UserProfileEntity);
    expect(repository.updateByUserUuid).toHaveBeenCalledWith(userUuid, {
      firstName: 'Updated',
    });
  });

  it('supports partial updates', async () => {
    const { service, repository } = createService();
    repository.findByUserUuid.mockResolvedValueOnce(profile());
    await service.update({ sub: userUuid }, userUuid, { locale: 'en' });
    expect(repository.updateByUserUuid).toHaveBeenCalledWith(userUuid, {
      locale: 'en',
    });
  });

  it('rejects invalid update data', async () => {
    const { service, repository } = createService();
    repository.findByUserUuid.mockResolvedValueOnce(profile());
    await expect(
      service.update({ sub: userUuid }, userUuid, { locale: 'invalid-locale' }),
    ).rejects.toBeInstanceOf(InvalidUserProfileError);
  });

  it('allows self update', () => {
    expect(() =>
      new UserProfileOwnershipPolicy().assertCanManage(
        { sub: userUuid },
        userUuid,
      ),
    ).not.toThrow();
  });

  it('blocks cross-user update without privilege', () => {
    expect(() =>
      new UserProfileOwnershipPolicy().assertCanManage(
        { sub: userUuid },
        otherUuid,
      ),
    ).toThrow(UserProfileAccessDeniedError);
  });

  it('allows privileged cross-user update', () => {
    expect(() =>
      new UserProfileOwnershipPolicy().assertCanManage(
        { sub: userUuid, permissions: ['users:manage'] },
        otherUuid,
      ),
    ).not.toThrow();
  });

  it('rejects credential fields through the create DTO contract', async () => {
    const dto = Object.assign(new CreateUserProfileDto(), {
      password: 'secret',
      passwordHash: 'hash',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['password', 'passwordHash']),
    );
  });

  it('rejects security fields through the update DTO contract', async () => {
    const dto = Object.assign(new UpdateUserProfileDto(), {
      refreshToken: 'token',
      twoFactorSecret: 'secret',
      securityState: 'enabled',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'refreshToken',
        'twoFactorSecret',
        'securityState',
      ]),
    );
  });

  it('serializes only public profile fields', () => {
    const result = serializeUserProfile(profile());
    expect(result).toEqual(
      expect.objectContaining({ userUuid, firstName: 'Muhammad' }),
    );
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('securitySecret');
    expect(result).not.toHaveProperty('refreshToken');
    expect(result).not.toHaveProperty('twoFactorSecret');
    expect(result).not.toHaveProperty('permissions');
  });

  it('does not expose a password hash in the response mapper', () => {
    const result = serializeUserProfile(profile()) as Record<string, unknown>;
    expect(result.passwordHash).toBeUndefined();
  });

  it('does not expose a security secret in the response mapper', () => {
    const result = serializeUserProfile(profile()) as Record<string, unknown>;
    expect(result.securitySecret).toBeUndefined();
  });

  it('maps persistence to a domain entity without leaking Prisma shape', () => {
    const domain = PrismaUserProfileMapper.toDomain(
      {
        id: 42n,
        userId: 7n,
        firstName: 'Test',
        lastName: null,
        imageUrl: null,
        avatarThumbnailUrl: null,
        timezone: 'Asia/Jakarta',
        locale: 'id',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      userUuid,
    );
    expect(domain).toBeInstanceOf(UserProfileEntity);
    expect(domain.userUuid).toBe(userUuid);
  });

  it('keeps the transaction boundary independent for profile lifecycle', () => {
    expect(USER_PROFILE_TRANSACTION_POLICY.userAndProfileCreateAtomic).toBe(
      false,
    );
    expect(USER_PROFILE_TRANSACTION_POLICY.userAndProfileUpdateAtomic).toBe(
      false,
    );
    expect(USER_PROFILE_TRANSACTION_POLICY.profileLifecycleIndependent).toBe(
      true,
    );
  });

  it('does not require a persistence transaction for profile CRUD', () => {
    const { repository } = createService();
    expect(repository).not.toHaveProperty('$transaction');
  });
});
