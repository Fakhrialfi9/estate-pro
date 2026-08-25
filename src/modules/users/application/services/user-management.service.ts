import { Inject, Injectable } from '@nestjs/common';

import type { UserUpdate } from '../../domain/entities/user.entity.js';
import { UserEntity } from '../../domain/entities/user.entity.js';
import { DuplicateUserError, InvalidUserError, UserNotFoundError } from '../../domain/errors/user.errors.js';
import type { CreateUserData, UserListQuery, UserListResult, UserRepository } from '../../domain/repositories/user.repository.js';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.js';

@Injectable()
export class UserManagementService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async create(data: CreateUserData): Promise<UserEntity> {
    const normalized: CreateUserData = {
      username: this.normalizeNullable(data.username),
      email: this.normalizeNullable(data.email)?.toLowerCase() ?? null,
      phone: this.normalizeNullable(data.phone),
      status: data.status ?? 'pending',
    };

    if (!normalized.username && !normalized.email && !normalized.phone) {
      throw new InvalidUserError('At least one identity is required');
    }

    const duplicate = await this.users.findDuplicateIdentity(normalized);
    if (duplicate) throw new DuplicateUserError();

    try {
      return await this.users.create(normalized);
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'DuplicateUserError') throw error;
      throw error;
    }
  }

  async getByUuid(uuid: string): Promise<UserEntity> {
    const user = await this.users.findByUuid(uuid);
    if (!user) throw new UserNotFoundError();
    return user;
  }

  async getByEmail(email: string): Promise<UserEntity> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (!user) throw new UserNotFoundError();
    return user;
  }

  async getByUsername(username: string): Promise<UserEntity> {
    const user = await this.users.findByUsername(username);
    if (!user) throw new UserNotFoundError();
    return user;
  }

  async list(query: UserListQuery): Promise<UserListResult> {
    return this.users.list(query);
  }

  async update(uuid: string, changes: UserUpdate): Promise<UserEntity> {
    const existing = await this.users.findByUuid(uuid);
    if (!existing) throw new UserNotFoundError();

    const normalized: UserUpdate = {
      ...(changes.username !== undefined ? { username: this.normalizeNullable(changes.username) } : {}),
      ...(changes.email !== undefined ? { email: this.normalizeNullable(changes.email)?.toLowerCase() ?? null } : {}),
      ...(changes.phone !== undefined ? { phone: this.normalizeNullable(changes.phone) } : {}),
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
    };

    const nextUsername = normalized.username !== undefined ? normalized.username : existing.username;
    const nextEmail = normalized.email !== undefined ? normalized.email : existing.email;
    const nextPhone = normalized.phone !== undefined ? normalized.phone : existing.phone;
    if (!nextUsername && !nextEmail && !nextPhone) {
      throw new InvalidUserError('At least one identity is required');
    }

    const duplicate = await this.users.findDuplicateIdentity(normalized, uuid);
    if (duplicate) throw new DuplicateUserError();

    return this.users.update(uuid, normalized);
  }

  async remove(uuid: string): Promise<void> {
    const existing = await this.users.findByUuid(uuid);
    if (!existing) throw new UserNotFoundError();
    await this.users.softDelete(uuid);
  }

  private normalizeNullable(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
