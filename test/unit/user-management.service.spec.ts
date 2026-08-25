import { describe, expect, it, vi } from 'vitest';

import {
  DuplicateUserError,
  InvalidUserError,
  UserNotFoundError,
} from '../../src/modules/users/domain/errors/user.errors.js';
import { UserManagementService } from '../../src/modules/users/application/services/user-management.service.js';
import { UserEntity } from '../../src/modules/users/domain/entities/user.entity.js';
import type { UserRepository } from '../../src/modules/users/domain/repositories/user.repository.js';

const PASSWORD = 'Strong-Test-Password-123!';
const makeUser = (
  overrides: Partial<ReturnType<UserEntity['toSnapshot']>> = {},
) =>
  UserEntity.create({
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    username: 'john',
    email: 'john@example.com',
    phone: null,
    status: 'pending',
    isActive: true,
    isVerified: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  });

const repo = () => {
  const create = vi.fn(() => Promise.resolve(makeUser()));
  const createWithCredential = vi.fn(() => Promise.resolve(makeUser()));
  const findByUuid = vi.fn(() => Promise.resolve(null));
  const findByEmail = vi.fn(() => Promise.resolve(null));
  const findByUsername = vi.fn(() => Promise.resolve(null));
  const findByPhone = vi.fn(() => Promise.resolve(null));
  const findDuplicateIdentity = vi.fn(() => Promise.resolve(null));
  const list = vi.fn(() =>
    Promise.resolve({ items: [], total: 0, page: 1, limit: 20 }),
  );
  const update = vi.fn(() => Promise.resolve(makeUser()));
  const softDelete = vi.fn(() => Promise.resolve(undefined));
  const sessions = {
    revokeAllForSecurityEvent: vi.fn(() => Promise.resolve()),
  };
  const audit = { record: vi.fn(() => Promise.resolve()) };
  const credentials = {
    preparePasswordHash: vi.fn(() => Promise.resolve('argon2-hash')),
  };

  const repository: UserRepository = {
    create,
    createWithCredential,
    findByUuid,
    findByEmail,
    findByUsername,
    findByPhone,
    findDuplicateIdentity,
    list,
    update,
    softDelete,
  };

  return {
    repository,
    sessions,
    audit,
    credentials,
    mocks: {
      create,
      createWithCredential,
      findByUuid,
      findByEmail,
      findByUsername,
      findByPhone,
      findDuplicateIdentity,
      list,
      update,
      softDelete,
    },
  };
};

describe('UserManagementService', () => {
  it('creates a user with an Argon2 credential hash and never passes plaintext to persistence', async () => {
    const { repository, mocks, sessions, audit, credentials } = repo();
    const service = new UserManagementService(
      repository,
      sessions as never,
      audit as never,
      credentials as never,
    );
    const result = await service.create(
      { email: ' JOHN@EXAMPLE.COM ' },
      { password: PASSWORD, confirmation: PASSWORD },
    );
    expect(result.email).toBe('john@example.com');
    expect(credentials.preparePasswordHash).toHaveBeenCalledWith({
      password: PASSWORD,
      confirmation: PASSWORD,
    });
    expect(mocks.createWithCredential).toHaveBeenCalledWith(
      {
        email: 'john@example.com',
        username: null,
        phone: null,
        status: 'pending',
      },
      { passwordHash: 'argon2-hash' },
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects empty identity', async () => {
    const { repository, sessions, audit, credentials } = repo();
    const service = new UserManagementService(
      repository,
      sessions as never,
      audit as never,
      credentials as never,
    );
    await expect(
      service.create({}, { password: PASSWORD, confirmation: PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidUserError);
  });

  it('rejects duplicate identity before password hashing and persistence', async () => {
    const { repository, mocks, sessions, audit, credentials } = repo();
    mocks.findDuplicateIdentity.mockResolvedValue(makeUser());
    const service = new UserManagementService(
      repository,
      sessions as never,
      audit as never,
      credentials as never,
    );
    await expect(
      service.create(
        { email: 'john@example.com' },
        { password: PASSWORD, confirmation: PASSWORD },
      ),
    ).rejects.toBeInstanceOf(DuplicateUserError);
    expect(credentials.preparePasswordHash).not.toHaveBeenCalled();
    expect(mocks.createWithCredential).not.toHaveBeenCalled();
  });

  it('rejects updates to missing users', async () => {
    const { repository, sessions, audit, credentials } = repo();
    const service = new UserManagementService(
      repository,
      sessions as never,
      audit as never,
      credentials as never,
    );
    await expect(
      service.update('550e8400-e29b-41d4-a716-446655440000', {
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
