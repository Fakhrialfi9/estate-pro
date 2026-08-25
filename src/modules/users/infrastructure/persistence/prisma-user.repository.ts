import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';

import type {
  CreateUserData,
  UserFilterField,
  UserListQuery,
  UserListResult,
  UserRepository,
  UserSortField,
} from '../../domain/repositories/user.repository.js';
import type { UserUpdate } from '../../domain/entities/user.entity.js';
import { PrismaUserMapper } from './prisma-user.mapper.js';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserData) {
    try {
      const record = await this.prisma.authenticationUser.create({
        data: PrismaUserMapper.toPersistence(data),
      });
      return PrismaUserMapper.toDomain(record);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') {
        const duplicate = new Error('User identity is already in use');
        duplicate.name = 'DuplicateUserError';
        throw duplicate;
      }
      throw error;
    }
  }

  async findByUuid(uuid: string) {
    const record = await this.prisma.authenticationUser.findFirst({
      where: { uuid, deletedAt: null },
    });
    return record ? PrismaUserMapper.toDomain(record) : null;
  }

  async findByEmail(email: string) {
    const record = await this.prisma.authenticationUser.findFirst({
      where: { email, deletedAt: null },
    });
    return record ? PrismaUserMapper.toDomain(record) : null;
  }

  async findByUsername(username: string) {
    const record = await this.prisma.authenticationUser.findFirst({
      where: { username, deletedAt: null },
    });
    return record ? PrismaUserMapper.toDomain(record) : null;
  }

  async findByPhone(phone: string) {
    const record = await this.prisma.authenticationUser.findFirst({
      where: { phone, deletedAt: null },
    });
    return record ? PrismaUserMapper.toDomain(record) : null;
  }

  async findDuplicateIdentity(
    data: CreateUserData | UserUpdate,
    excludeUuid?: string,
  ) {
    const identities = [
      data.username !== undefined && data.username !== null
        ? { username: data.username }
        : null,
      data.email !== undefined && data.email !== null
        ? { email: data.email }
        : null,
      data.phone !== undefined && data.phone !== null
        ? { phone: data.phone }
        : null,
    ].filter(
      (
        value,
      ): value is
        | { username: string }
        | { email: string }
        | { phone: string } => value !== null,
    );

    if (identities.length === 0) return null;

    const record = await this.prisma.authenticationUser.findFirst({
      where: {
        deletedAt: null,
        ...(excludeUuid ? { NOT: { uuid: excludeUuid } } : {}),
        OR: identities,
      },
    });

    return record ? PrismaUserMapper.toDomain(record) : null;
  }

  async list(query: UserListQuery): Promise<UserListResult> {
    const where = {
      deletedAt: null,
      ...this.buildFilter(query.filterField, query.filterValue),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search } },
              { email: { contains: query.search } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.authenticationUser.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.authenticationUser.count({ where }),
    ]);

    return {
      items: records.map(PrismaUserMapper.toDomain),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async update(uuid: string, changes: UserUpdate) {
    try {
      const record = await this.prisma.authenticationUser.update({
        where: { uuid },
        data: PrismaUserMapper.toPersistence(changes),
      });
      return PrismaUserMapper.toDomain(record);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') {
        const duplicate = new Error('User identity is already in use');
        duplicate.name = 'DuplicateUserError';
        throw duplicate;
      }
      throw error;
    }
  }

  async softDelete(uuid: string): Promise<void> {
    await this.prisma.authenticationUser.update({
      where: { uuid },
      data: { deletedAt: new Date(), isActive: false, status: 'inactive' },
    });
  }

  private buildFilter(field?: UserFilterField, value?: string) {
    if (!field || value === undefined) return {};
    if (field === 'isActive')
      return { isActive: value.toLowerCase() === 'true' };
    return { [field as Exclude<UserFilterField, 'isActive'>]: value };
  }
}
