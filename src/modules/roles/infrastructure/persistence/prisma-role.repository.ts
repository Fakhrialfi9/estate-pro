import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  normalizeRoleCode,
  normalizeRoleName,
  type RoleUpdate,
} from '../../domain/entities/role.entity.js';
import type {
  CreateRoleData,
  RoleFilterField,
  RoleListQuery,
  RoleListResult,
  RoleRepository,
  RoleSortField,
  RoleDependencyCount,
} from '../../domain/repositories/role.repository.js';
import {
  PrismaRoleMapper,
  type RolePersistenceData,
  type RolePersistenceRecord,
} from './prisma-role.mapper.js';

interface RoleWhere {
  uuid?: string;
  name?: { contains: string } | string;
  code?: string;
  isActive?: boolean;
  OR?: Array<{ name?: { contains: string }; code?: { contains: string } }>;
}

type RoleDelegate = {
  create(args: { data: RolePersistenceData }): Promise<RolePersistenceRecord>;
  findFirst(args: { where: RoleWhere }): Promise<RolePersistenceRecord | null>;
  findMany(args: {
    where: RoleWhere;
    orderBy:
      | Record<RoleSortField, 'asc' | 'desc'>
      | Record<string, 'asc' | 'desc'>;
    skip: number;
    take: number;
  }): Promise<RolePersistenceRecord[]>;
  count(args: { where: RoleWhere }): Promise<number>;
  update(args: {
    where: { uuid: string };
    data: RolePersistenceData;
  }): Promise<RolePersistenceRecord>;
  delete(args: { where: { uuid: string } }): Promise<RolePersistenceRecord>;
};

type RelationDelegate = {
  count(args: { where: { roleId: bigint } }): Promise<number>;
};

type PrismaRoleClient = {
  authorizationRole: RoleDelegate;
  authorizationUserRole: RelationDelegate;
  authorizationRolePermission: RelationDelegate;
};

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  private readonly roles: RoleDelegate;
  private readonly userRoles: RelationDelegate;
  private readonly rolePermissions: RelationDelegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaRoleClient;
    this.roles = client.authorizationRole;
    this.userRoles = client.authorizationUserRole;
    this.rolePermissions = client.authorizationRolePermission;
  }

  async create(data: CreateRoleData) {
    try {
      const record = await this.roles.create({
        data: {
          uuid: randomUUID(),
          name: normalizeRoleName(data.name),
          code: normalizeRoleCode(data.code),
          description: data.description ?? null,
        },
      });
      return PrismaRoleMapper.toDomain(record);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') {
        const target = String(
          (error as { meta?: { target?: unknown } }).meta?.target ?? '',
        );
        if (target.includes('code'))
          throw new Error('RoleCodeAlreadyExistsError');
        throw new Error('RoleAlreadyExistsError');
      }
      throw error;
    }
  }

  async findByUuid(uuid: string) {
    const record = await this.roles.findFirst({ where: { uuid } });
    return record ? PrismaRoleMapper.toDomain(record) : null;
  }

  async findByCode(code: string) {
    const record = await this.roles.findFirst({
      where: { code: normalizeRoleCode(code) },
    });
    return record ? PrismaRoleMapper.toDomain(record) : null;
  }

  async findByName(name: string) {
    const normalized = normalizeRoleName(name);
    const record = await this.roles.findFirst({ where: { name: normalized } });
    return record ? PrismaRoleMapper.toDomain(record) : null;
  }

  async list(query: RoleListQuery): Promise<RoleListResult> {
    const where: RoleWhere = {
      ...this.buildFilter(query.filterField, query.filterValue),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { code: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      this.roles.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.roles.count({ where }),
    ]);

    return {
      items: records.map((record) => PrismaRoleMapper.toDomain(record)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async update(uuid: string, changes: RoleUpdate) {
    try {
      const data: RolePersistenceData = {
        ...(changes.name !== undefined
          ? { name: normalizeRoleName(changes.name) }
          : {}),
        ...(changes.description !== undefined
          ? { description: changes.description }
          : {}),
        ...(changes.isActive !== undefined
          ? { isActive: changes.isActive }
          : {}),
      };
      const record = await this.roles.update({ where: { uuid }, data });
      return PrismaRoleMapper.toDomain(record);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002')
        throw new Error('RoleAlreadyExistsError');
      throw error;
    }
  }

  async delete(uuid: string): Promise<void> {
    await this.roles.delete({ where: { uuid } });
  }

  async getDependencyCount(uuid: string): Promise<RoleDependencyCount> {
    const role = await this.roles.findFirst({ where: { uuid } });
    if (!role) return { userAssignments: 0, permissionAssignments: 0 };
    const internalId = BigInt((role as unknown as { id: bigint }).id);
    const [userAssignments, permissionAssignments] = await Promise.all([
      this.userRoles.count({ where: { roleId: internalId } }),
      this.rolePermissions.count({ where: { roleId: internalId } }),
    ]);
    return { userAssignments, permissionAssignments };
  }

  private buildFilter(field?: RoleFilterField, value?: string): RoleWhere {
    if (!field || value === undefined) return {};
    switch (field) {
      case 'name':
        return { name: normalizeRoleName(value) };
      case 'code':
        return { code: normalizeRoleCode(value) };
      case 'isActive':
        return { isActive: value.toLowerCase() === 'true' };
      case 'isSystem': {
        const code = normalizeRoleCode(value);
        return {
          code: ['admin', 'owner', 'super-admin', 'system'].includes(code)
            ? code
            : '__not_protected__',
        };
      }
    }
  }
}
