import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AuthorizationSnapshot,
  UserAuthorizationRepository,
} from '../../../common/security/authorization.repository.js';

type UserRolePermissionRecord = {
  role: {
    code: string;
    isActive: boolean;
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
export class PrismaUserAuthorizationRepository implements UserAuthorizationRepository {
  private readonly users: UserDelegate;
  private readonly userRoles: UserRoleDelegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaAuthorizationShape;
    this.users = client.authenticationUser;
    this.userRoles = client.authorizationUserRole;
  }

  async listPermissionCodes(userUuid: string): Promise<readonly string[]> {
    const snapshot = await this.getAuthorizationSnapshot(userUuid);
    return snapshot?.permissionCodes ?? [];
  }

  async getAuthorizationSnapshot(
    userUuid: string,
  ): Promise<AuthorizationSnapshot | null> {
    const user = await this.users.findFirst({
      where: { uuid: userUuid },
      select: { id: true },
    });
    if (!user) return null;

    const assignments = await this.userRoles.findMany({
      where: {
        userId: user.id,
        isActive: true,
        role: { isActive: true },
      },
      select: {
        role: {
          select: {
            code: true,
            isActive: true,
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

    const roleCodes = new Set<string>();
    const permissionCodes = new Set<string>();

    for (const assignment of assignments) {
      if (!assignment.role.isActive) continue;
      roleCodes.add(assignment.role.code);
      for (const rolePermission of assignment.role.permissions) {
        permissionCodes.add(rolePermission.permission.code);
      }
    }

    return {
      userUuid,
      roleCodes: [...roleCodes],
      permissionCodes: [...permissionCodes],
    };
  }
}
