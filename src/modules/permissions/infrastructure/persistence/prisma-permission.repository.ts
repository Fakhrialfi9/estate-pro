import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  buildPermissionCode,
  normalizePermissionName,
  normalizePermissionSegment,
  PROTECTED_PERMISSION_CODES,
  type PermissionUpdate,
} from '../../domain/entities/permission.entity.js';
import type {
  CreatePermissionData,
  PermissionDependencyCount,
  PermissionFilterField,
  PermissionListQuery,
  PermissionListResult,
  PermissionRepository,
  PermissionSortField,
} from '../../domain/repositories/permission.repository.js';
import {
  PrismaPermissionMapper,
  type PermissionPersistenceData,
  type PermissionPersistenceRecord,
} from './prisma-permission.mapper.js';

type PermissionWhere = {
  uuid?: string;
  code?: string | { in: string[] };
  module?: string;
  domain?: string;
  action?: string;
  name?: string;
  NOT?: { code?: { in: string[] } };
};

type PermissionDelegate = {
  create(args: {
    data: PermissionPersistenceData & { uuid: string; code: string };
  }): Promise<PermissionPersistenceRecord>;
  findFirst(args: { where: PermissionWhere }): Promise<PermissionPersistenceRecord | null>;
  findMany(args: {
    where: PermissionWhere;
    orderBy: Record<PermissionSortField, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>;
    skip: number;
    take: number;
  }): Promise<PermissionPersistenceRecord[]>;
  count(args: { where: PermissionWhere }): Promise<number>;
  update(args: {
    where: { uuid: string };
    data: PermissionPersistenceData;
  }): Promise<PermissionPersistenceRecord>;
  delete(args: { where: { uuid: string } }): Promise<PermissionPersistenceRecord>;
};

type RelationDelegate = {
  count(args: { where: { permissionId: bigint } }): Promise<number>;
};

type PrismaPermissionClient = {
  authorizationPermission: PermissionDelegate;
  authorizationRolePermission: RelationDelegate;
};

@Injectable()
export class PrismaPermissionRepository implements PermissionRepository {
  private readonly permissions: PermissionDelegate;
  private readonly rolePermissions: RelationDelegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaPermissionClient;
    this.permissions = client.authorizationPermission;
    this.rolePermissions = client.authorizationRolePermission;
  }

  async create(data: CreatePermissionData) {
    const module = normalizePermissionSegment(data.module);
    const domain = normalizePermissionSegment(data.domain);
    const action = normalizePermissionSegment(data.action);
    const name = normalizePermissionName(data.name);
    const code = buildPermissionCode(module, domain, action);

    try {
      const record = await this.permissions.create({
        data: {
          uuid: randomUUID(),
          name,
          code,
          module,
          domain,
          action,
        },
      });
      return PrismaPermissionMapper.toDomain(record);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') {
        const target = (error as { meta?: { target?: unknown } }).meta?.target;
        const targetFields = Array.isArray(target)
          ? target.filter((value): value is string => typeof value === 'string')
          : typeof target === 'string'
            ? [target]
            : [];
        if (targetFields.includes('code')) {
          throw new Error('PermissionAlreadyExistsError');
        }
        throw new Error('PermissionResourceActionAlreadyExistsError');
      }
      throw error;
    }
  }

  async findByUuid(uuid: string) {
    const record = await this.permissions.findFirst({ where: { uuid } });
    return record ? PrismaPermissionMapper.toDomain(record) : null;
  }

  async findByCode(code: string) {
    const record = await this.permissions.findFirst({
      where: { code: normalizePermissionSegment(code) },
    });
    return record ? PrismaPermissionMapper.toDomain(record) : null;
  }

  async findByResourceAction(module: string, domain: string, action: string) {
    const normalizedModule = normalizePermissionSegment(module);
    const normalizedDomain = normalizePermissionSegment(domain);
    const normalizedAction = normalizePermissionSegment(action);
    const record = await this.permissions.findFirst({
      where: {
        module: normalizedModule,
        domain: normalizedDomain,
        action: normalizedAction,
      },
    });
    return record ? PrismaPermissionMapper.toDomain(record) : null;
  }

  async list(query: PermissionListQuery): Promise<PermissionListResult> {
    const where = this.buildFilter(query.filterField, query.filterValue);
    const [records, total] = await Promise.all([
      this.permissions.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.permissions.count({ where }),
    ]);

    return {
      items: records.map((record) => PrismaPermissionMapper.toDomain(record)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async update(uuid: string, changes: PermissionUpdate) {
    try {
      const data: PermissionPersistenceData =
        changes.name !== undefined
          ? { name: normalizePermissionName(changes.name) }
          : {};
      const record = await this.permissions.update({
        where: { uuid },
        data,
      });
      return PrismaPermissionMapper.toDomain(record);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2025') {
        throw new Error('PermissionNotFoundError');
      }
      throw error;
    }
  }

  async delete(uuid: string): Promise<void> {
    await this.permissions.delete({ where: { uuid } });
  }

  async getDependencyCount(uuid: string): Promise<PermissionDependencyCount> {
    const permission = await this.permissions.findFirst({ where: { uuid } });
    if (!permission) return { roleAssignments: 0 };
    const internalId = BigInt((permission as unknown as { id: bigint }).id);
    return {
      roleAssignments: await this.rolePermissions.count({
        where: { permissionId: internalId },
      }),
    };
  }

  private buildFilter(field?: PermissionFilterField, value?: string): PermissionWhere {
    if (!field || value === undefined) return {};
    switch (field) {
      case 'module':
        return { module: normalizePermissionSegment(value) };
      case 'domain':
        return { domain: normalizePermissionSegment(value) };
      case 'action':
        return { action: normalizePermissionSegment(value) };
      case 'isSystem': {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
          return { code: { in: [...PROTECTED_PERMISSION_CODES] } };
        }
        if (normalized === 'false') {
          return { NOT: { code: { in: [...PROTECTED_PERMISSION_CODES] } } };
        }
        return { code: { in: [] } };
      }
    }
  }
}
