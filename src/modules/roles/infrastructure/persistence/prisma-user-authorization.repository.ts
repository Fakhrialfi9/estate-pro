import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { UserAuthorizationRepository } from '../../domain/repositories/user-authorization.repository.js';

type UserRolePermissionRecord = {
  role: {
    permissions: Array<{
      permission: { code: string };
    }>;
  };
};

type UserDelegate = {
  findFirst(args: unknown): Promise<{ id: bigint } | null>;
};
type UserRoleDelegate = {
  findMany(args: unknown): Promise<UserRolePermissionRecord[]>;
};

type PrismaAuthorizationShape = {
  authenticationUser: UserDelegate;
  authorizationUserRole: UserRoleDelegate;
};

@Injectable()
export class PrismaUserAuthorizationRepository
  implements UserAuthorizationRepository
{
  private readonly users: UserDelegate;
  private readonly userRoles: UserRoleDelegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaAuthorizationShape;
    this.users = client.authenticationUser;
    this.userRoles = client.authorizationUserRole;
  }

  async listPermissionCodes(userUuid: string): Promise<readonly string[]> {
    const user = await this.users.findFirst({
      where: { uuid: userUuid },
      select: { id: true },
    });
    if (!user) return [];

    const assignments = await this.userRoles.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        role: {
          select: {
            permissions: {
              select: {
                permission: {
                  select: { code: true },
                },
              },
            },
          },
        },
      },
    });

    const codes = new Set<string>();
    for (const assignment of assignments) {
      for (const rolePermission of assignment.role.permissions) {
        codes.add(rolePermission.permission.code);
      }
    }
    return [...codes];
  }
}
