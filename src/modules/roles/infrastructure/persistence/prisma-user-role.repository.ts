import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { UserRoleEntity } from '../../domain/entities/user-role.entity.js';
import type {
  AssignUserRoleData,
  RemoveUserRoleData,
  UserRoleListQuery,
  UserRoleListResult,
  UserRoleRepository,
} from '../../domain/repositories/user-role.repository.js';

type UserRecord = { id: bigint; uuid: string };
type RoleRecord = {
  id: bigint;
  uuid: string;
  name: string;
  code: string;
};

type UserRoleRecord = {
  userId: bigint;
  roleId: bigint;
  isActive: boolean;
  assignedBy: bigint | null;
  assignedAt: Date;
  revokedAt: Date | null;
  role: {
    uuid: string;
    name: string;
    code: string;
  };
};

interface UserDelegate {
  findFirst(args: unknown): Promise<UserRecord | null>;
}
interface RoleDelegate {
  findFirst(args: unknown): Promise<RoleRecord | null>;
}
interface UserRoleDelegate {
  findFirst(args: unknown): Promise<UserRoleRecord | null>;
  findMany(args: unknown): Promise<UserRoleRecord[]>;
  count(args: unknown): Promise<number>;
  create(args: unknown): Promise<UserRoleRecord>;
  update(args: unknown): Promise<UserRoleRecord>;
}
interface PrismaUserRoleShape {
  authenticationUser: UserDelegate;
  authorizationRole: RoleDelegate;
  authorizationUserRole: UserRoleDelegate;
  $transaction<T>(
    callback: (tx: PrismaUserRoleShape) => Promise<T>,
  ): Promise<T>;
}

@Injectable()
export class PrismaUserRoleRepository implements UserRoleRepository {
  private readonly client: PrismaUserRoleShape;

  constructor(prisma: PrismaService) {
    this.client = prisma as unknown as PrismaUserRoleShape;
  }

  async findByUserAndRole(
    userUuid: string,
    roleUuid: string,
  ): Promise<UserRoleEntity | null> {
    const user = await this.client.authenticationUser.findFirst({
      where: { uuid: userUuid },
      select: { id: true, uuid: true },
    });
    const role = await this.client.authorizationRole.findFirst({
      where: { uuid: roleUuid },
      select: { id: true, uuid: true, name: true, code: true },
    });
    if (!user || !role) return null;

    const record = await this.client.authorizationUserRole.findFirst({
      where: { userId: user.id, roleId: role.id },
      include: { role: true },
    });
    return record ? this.toDomain(record, user.uuid, null) : null;
  }

  async assign(data: AssignUserRoleData): Promise<UserRoleEntity> {
    return this.client.$transaction(async (tx) => {
      const [user, role, assignedBy] = await Promise.all([
        tx.authenticationUser.findFirst({
          where: { uuid: data.userUuid },
          select: { id: true, uuid: true },
        }),
        tx.authorizationRole.findFirst({
          where: { uuid: data.roleUuid },
          select: { id: true, uuid: true, name: true, code: true },
        }),
        tx.authenticationUser.findFirst({
          where: { uuid: data.assignedByUuid },
          select: { id: true, uuid: true },
        }),
      ]);

      if (!user || !role || !assignedBy) {
        throw new Error('UserRoleAssignmentContextNotFound');
      }

      const existing = await tx.authorizationUserRole.findFirst({
        where: { userId: user.id, roleId: role.id },
        include: { role: true },
      });

      if (existing?.isActive) {
        throw new Error('UserRoleAlreadyExistsError');
      }

      try {
        const record = existing
          ? await tx.authorizationUserRole.update({
              where: {
                userId_roleId: {
                  userId: user.id,
                  roleId: role.id,
                },
              },
              data: {
                isActive: true,
                assignedBy: assignedBy.id,
                assignedAt: new Date(),
                revokedAt: null,
              },
              include: { role: true },
            })
          : await tx.authorizationUserRole.create({
              data: {
                userId: user.id,
                roleId: role.id,
                isActive: true,
                assignedBy: assignedBy.id,
                assignedAt: new Date(),
                revokedAt: null,
              },
              include: { role: true },
            });

        return this.toDomain(record, user.uuid, data.assignedByUuid);
      } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') {
          throw new Error('UserRoleAlreadyExistsError');
        }
        throw error;
      }
    });
  }

  async remove(data: RemoveUserRoleData): Promise<UserRoleEntity> {
    const [user, role] = await Promise.all([
      this.client.authenticationUser.findFirst({
        where: { uuid: data.userUuid },
        select: { id: true, uuid: true },
      }),
      this.client.authorizationRole.findFirst({
        where: { uuid: data.roleUuid },
        select: { id: true, uuid: true, name: true, code: true },
      }),
    ]);

    if (!user || !role) throw new Error('UserRoleNotFoundError');

    const existing = await this.client.authorizationUserRole.findFirst({
      where: { userId: user.id, roleId: role.id },
      include: { role: true },
    });
    if (!existing || !existing.isActive) {
      throw new Error('UserRoleNotFoundError');
    }

    const record = await this.client.authorizationUserRole.update({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
      include: { role: true },
    });

    return this.toDomain(record, user.uuid, null);
  }

  async listByUser(
    userUuid: string,
    query: UserRoleListQuery,
  ): Promise<UserRoleListResult> {
    const user = await this.client.authenticationUser.findFirst({
      where: { uuid: userUuid },
      select: { id: true, uuid: true },
    });
    if (!user) throw new Error('UserRoleNotFoundError');

    const where = { userId: user.id, isActive: true };
    const page =
      Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
    const limit = Number.isInteger(query.limit)
      ? Math.min(Math.max(query.limit, 1), 100)
      : 50;
    const [records, total] = await Promise.all([
      this.client.authorizationUserRole.findMany({
        where,
        orderBy: [{ assignedAt: 'desc' }, { roleId: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { role: true },
      }),
      this.client.authorizationUserRole.count({ where }),
    ]);

    return {
      items: records.map((record) => this.toDomain(record, user.uuid, null)),
      total,
    };
  }

  private toDomain(
    record: UserRoleRecord,
    userUuid: string,
    assignedByUuid: string | null,
  ): UserRoleEntity {
    return UserRoleEntity.create({
      userUuid,
      roleUuid: record.role.uuid,
      roleName: record.role.name,
      roleCode: record.role.code,
      roleIsSystem: ['admin', 'owner', 'super-admin', 'system'].includes(
        record.role.code,
      ),
      isActive: record.isActive,
      assignedByUuid,
      assignedAt: record.assignedAt,
      revokedAt: record.revokedAt,
    });
  }
}
