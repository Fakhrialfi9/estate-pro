import { describe, expect, it, vi } from 'vitest';

import { UserManagementService } from '../../../src/modules/users/application/services/user-management.service.js';
import { UserProfileService } from '../../../src/modules/users/profile/application/services/user-profile.service.js';
import { UserEntity } from '../../../src/modules/users/domain/entities/user.entity.js';
import { UserProfileEntity } from '../../../src/modules/users/profile/domain/entities/user-profile.entity.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const anotherUuid = '22222222-2222-4222-8222-222222222222';
const password = 'Strong-Test-Password-123!';

const makeUser = (
  overrides: Partial<ReturnType<UserEntity['toSnapshot']>> = {},
) =>
  UserEntity.create({
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
    ...overrides,
  });

const makeProfile = () =>
  UserProfileEntity.create({
    id: '1',
    userUuid: uuid,
    firstName: 'Jane',
    lastName: 'Doe',
    imageUrl: null,
    avatarThumbnailUrl: null,
    timezone: 'Asia/Jakarta',
    locale: 'id-ID',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });

describe('user management and profile branch coverage', () => {
  it('covers user lookup, update lifecycle, auditing and deletion', async () => {
    const existing = makeUser();
    const updated = makeUser({
      email: 'new@example.com',
      status: 'inactive',
      isActive: false,
    });
    const users = {
      findByUuid: vi.fn().mockResolvedValue(existing),
      findByEmail: vi.fn().mockResolvedValue(existing),
      findByUsername: vi.fn().mockResolvedValue(existing),
      findDuplicateIdentity: vi.fn().mockResolvedValue(null),
      list: vi
        .fn()
        .mockResolvedValue({ items: [existing], total: 1, page: 1, limit: 20 }),
      createWithCredential: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    const sessions = {
      revokeAllForSecurityEvent: vi.fn().mockResolvedValue(undefined),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const credentials = {
      preparePasswordHash: vi.fn().mockResolvedValue('hash'),
    };
    const service = new UserManagementService(
      users as never,
      sessions,
      audit,
      credentials as never,
    );

    await expect(service.getByUuid(uuid)).resolves.toBe(existing);
    await expect(service.getByEmail('JANE@EXAMPLE.COM')).resolves.toBe(existing);
    await expect(service.getByUsername('jane')).resolves.toBe(existing);
    await expect(service.list({ page: 1, limit: 20 })).resolves.toMatchObject({
      total: 1,
    });

    await expect(
      service.create(
        { username: '  ', phone: ' 0812 ', email: ' JANE@EXAMPLE.COM ' },
        { password, confirmation: password },
        {
          actorUuid: anotherUuid,
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          requestId: 'req',
        },
      ),
    ).resolves.toBe(existing);
    expect(users.createWithCredential).toHaveBeenCalled();

    await expect(
      service.update(uuid, { email: 'new@example.com' }),
    ).resolves.toBe(updated);
    await expect(
      service.update(uuid, { status: 'inactive' }, { actorUuid: anotherUuid }),
    ).resolves.toBe(updated);
    expect(sessions.revokeAllForSecurityEvent).toHaveBeenCalledWith(
      uuid,
      'ACCOUNT_DISABLED',
      expect.objectContaining({ actorUuid: anotherUuid }),
    );

    users.findByUuid.mockResolvedValueOnce(makeUser({ status: 'suspended' }));
    users.update.mockResolvedValueOnce(makeUser({ status: 'suspended' }));
    await service.update(uuid, { status: 'suspended' });
    expect(sessions.revokeAllForSecurityEvent).toHaveBeenCalledWith(
      uuid,
      'ACCOUNT_SUSPENDED',
      {},
    );

    users.findByUuid.mockResolvedValueOnce(makeUser({ username: 'only' }));
    users.findDuplicateIdentity.mockResolvedValueOnce(makeUser());
    await expect(
      service.update(uuid, { email: 'duplicate@example.com' }),
    ).rejects.toThrow();

    users.findByUuid.mockResolvedValueOnce(
      makeUser({ username: null, email: null, phone: ' ' }),
    );
    await expect(service.update(uuid, { username: ' ' })).resolves.toBe(updated);

    users.findByUuid.mockResolvedValueOnce(existing);
    await expect(
      service.remove(uuid, { requestId: 'delete-1' }),
    ).resolves.toBeUndefined();
    expect(users.softDelete).toHaveBeenCalledWith(uuid);
  });

  it('covers profile ownership, existence, normalization and validation branches', async () => {
    const profile = makeProfile();
    const principal = { actorUuid: uuid, permissions: [] };
    const ownership = { assertCanManage: vi.fn() };
    const users = { getByUuid: vi.fn().mockResolvedValue(makeUser()) };
    const profiles = {
      findByUserUuid: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(profile),
      updateByUserUuid: vi.fn().mockResolvedValue(profile),
    };
    const service = new UserProfileService(profiles, users, ownership);

    await expect(
      service.create(principal, uuid, {
        firstName: ' Jane ',
        lastName: ' Doe ',
        imageUrl: ' ',
        avatarThumbnailUrl: ' thumb ',
        timezone: ' Asia/Jakarta ',
        locale: ' id-ID ',
      }),
    ).resolves.toBe(profile);
    expect(profiles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        imageUrl: null,
        avatarThumbnailUrl: 'thumb',
        timezone: 'Asia/Jakarta',
        locale: 'id-ID',
      }),
    );

    profiles.findByUserUuid.mockResolvedValueOnce(profile);
    await expect(service.create(principal, uuid, {})).rejects.toThrow();
    profiles.findByUserUuid.mockResolvedValueOnce(profile);
    await expect(service.get(principal, uuid)).resolves.toBe(profile);
    profiles.findByUserUuid.mockResolvedValueOnce(null);
    await expect(service.get(principal, uuid)).rejects.toThrow();
    profiles.findByUserUuid.mockResolvedValueOnce(profile);
    await expect(
      service.update(principal, uuid, { firstName: null, timezone: ' UTC ' }),
    ).resolves.toBe(profile);

    const invalidInputs = [
      { firstName: 'x'.repeat(101) },
      { lastName: 'x'.repeat(101) },
      { imageUrl: 'x'.repeat(501) },
      { avatarThumbnailUrl: 'x'.repeat(501) },
      { timezone: ' ' },
      { timezone: 'x'.repeat(101) },
      { locale: 'invalid' },
    ] as const;
    for (const input of invalidInputs) {
      profiles.findByUserUuid.mockResolvedValue(profile);
      await expect(service.update(principal, uuid, input)).rejects.toThrow();
    }
  });
});
