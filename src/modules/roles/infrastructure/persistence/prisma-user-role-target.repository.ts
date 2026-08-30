import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  UserRoleTarget,
  UserRoleTargetRepository,
} from '../../domain/repositories/user-role-target.repository.js';

type AuthenticationUserDelegate = {
  findFirst(args: unknown): Promise<{ uuid: string } | null>;
};

type PrismaUserRoleTargetShape = {
  authenticationUser: AuthenticationUserDelegate;
};

@Injectable()
export class PrismaUserRoleTargetRepository
  implements UserRoleTargetRepository
{
  private readonly users: AuthenticationUserDelegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaUserRoleTargetShape;
    this.users = client.authenticationUser;
  }

  async findByUuid(userUuid: string): Promise<UserRoleTarget | null> {
    return this.users.findFirst({
      where: { uuid: userUuid },
      select: { uuid: true },
    });
  }
}
