import { describe, expect, it, vi } from 'vitest';

import {
  DuplicateUserError,
  InvalidUserError,
  UserNotFoundError,
} from '../../src/modules/users/domain/errors/user.errors.js';
import { UserManagementService } from '../../src/modules/users/application/services/user-management.service.js';
import { UserEntity } from '../../src/modules/users/domain/entities/user.entity.js';
import type { UserRepository } from '../../src/modules/users/domain/repositories/user.repository.js';

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

const repo = (): UserRepository => ({
  create: vi.fn(() => Promise.resolve(makeUser())),
  findByUuid: vi.fn(() => Promise.resolve(null)),
  findByEmail: vi.fn(() => Promise.resolve(null)),
  findByUsername: vi.fn(() => Promise.resolve(null)),
  findByPhone: vi.fn(() => Promise.resolve(null)),
  findDuplicateIdentity: vi.fn(() => Promise.resolve(null)),
  list: vi.fn(() =>
    Promise.resolve({ items: [], total: 0, page: 1, limit: 20 }),
  ),
  update: vi.fn(() => Promise.resolve(makeUser())),
  softDelete: vi.fn(() => Promise.resolve(undefined)),
});

describe('UserManagementService', () => {
  it('creates a user from an allowed identity', async () => {
    const repository = repo();
    const service = new UserManagementService(repository);
    const result = await service.create({ email: ' JOHN@EXAMPLE.COM ' });
    expect(result.email).toBe('john@example.com');
    expect(vi.mocked(repository.create)).toHaveBeenCalledWith({
      email: 'john@example.com',
      username: null,
      phone: null,
      status: 'pending',
    });
  });

  it('rejects empty identity', async () => {
    const service = new UserManagementService(repo());
    await expect(service.create({})).rejects.toBeInstanceOf(InvalidUserError);
  });

  it('rejects duplicate identity before persistence', async () => {
    const repository = repo();
    vi.mocked(repository.findDuplicateIdentity).mockResolvedValue(makeUser());
    const service = new UserManagementService(repository);
    await expect(
      service.create({ email: 'john@example.com' }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
    expect(vi.mocked(repository.create)).not.toHaveBeenCalled();
  });

  it('rejects updates to missing users', async () => {
    const service = new UserManagementService(repo());
    await expect(
      service.update('550e8400-e29b-41d4-a716-446655440000', {
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
