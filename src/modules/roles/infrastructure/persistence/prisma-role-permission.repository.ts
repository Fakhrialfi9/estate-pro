import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  RolePermissionListQuery,
  RolePermissionListResult,
  RolePermissionRepository,
} from '../../domain/repositories/role-permission.repository.js';

type PrismaShape = {
  authorizationRole: {
    findFirst(args: unknown): Promise<unknown>;
  };
  authorizationPermission: {
    findFirst(args: unknown): Promise<unknown>;
  };
  authorizationRolePermission: {
    findFirst(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
    count(args: unknown): Promise<unknown>;
  };
};

type PermissionRow = {
  uuid: string;
  name: string;
  code: string;
  module: string;
  domain: string;
  action: string;
  createdAt: Date;
  updatedAt: Date;
};

type RelationRow = {
  permission: PermissionRow;
};

@Injectable()
export class PrismaRolePermissionRepository
  implements RolePermissionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async exists(roleUuid: string, permissionUuid: string): Promise<boolean> {
    const role = (await this.client.authorizationRole.findFirst({
      where: { uuid: roleUuid },
      select: { id: true },
    })) as { id: bigint } | null;
    const permission = (await this.client.authorizationPermission.findFirst({
      where: { uuid: permissionUuid },
      select: { id: true },
    })) as { id: bigint } | null;
    if (!role || !permission) return false;

    const relation = await this.client.authorizationRolePermission.findFirst({
      where: { roleId: role.id, permissionId: permission.id },
      select: { roleId: true },
    });
    return relation !== null;
  }

  async assign(roleUuid: string, permissionUuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        const client = transaction as unknown as PrismaShape;
        const role = (await client.authorizationRole.findFirst({
          where: { uuid: roleUuid },
          select: { id: true },
        })) as { id: bigint } | null;
        if (!role) throw new Error('RoleNotFoundError');

        const permission = (await client.authorizationPermission.findFirst({
          where: { uuid: permissionUuid },
          select: { id: true },
        })) as { id: bigint } | null;
        if (!permission) throw new Error('PermissionNotFoundError');

        await client.authorizationRolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      });
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002') {
        throw new Error('RolePermissionAlreadyExistsError');
      }
      if (code === 'P2003') {
        throw new Error('RolePermissionConflictError');
      }
      throw error;
    }
  }

  async remove(roleUuid: string, permissionUuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        const client = transaction as unknown as PrismaShape;
        const role = (await client.authorizationRole.findFirst({
          where: { uuid: roleUuid },
          select: { id: true },
        })) as { id: bigint } | null;
        if (!role) throw new Error('RoleNotFoundError');

        const permission = (await client.authorizationPermission.findFirst({
          where: { uuid: permissionUuid },
          select: { id: true },
        })) as { id: bigint } | null;
        if (!permission) throw new Error('PermissionNotFoundError');

        await client.authorizationRolePermission.delete({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
        });
      });
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'P2025') {
        throw new Error('RolePermissionNotFoundError');
      }
      if (code === 'P2003') {
        throw new Error('RolePermissionConflictError');
      }
      throw error;
    }
  }

  async listByRole(
    roleUuid: string,
    query: RolePermissionListQuery,
  ): Promise<RolePermissionListResult> {
    const role = (await this.client.authorizationRole.findFirst({
      where: { uuid: roleUuid },
      select: { id: true },
    })) as { id: bigint } | null;
    if (!role) throw new Error('RoleNotFoundError');

    const where = { roleId: role.id };
    const [records, totalRaw] = await Promise.all([
      this.client.authorizationRolePermission.findMany({
        where,
        include: { permission: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }) as Promise<RelationRow[]>,
      this.client.authorizationRolePermission.count({
        where,
      }) as Promise<number>,
    ]);

    return {
      items: records.map((record) => ({ ...record.permission })),
      total: totalRaw,
      page: query.page,
      limit: query.limit,
    };
  }

  private get client(): PrismaShape {
    return this.prisma;
  }
}
