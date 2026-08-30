import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { TwoFactorRecoveryCodeRepository } from '../../domain/repositories/two-factor-recovery-code.repository.js';

type UserDelegate = {
  findUnique(args: unknown): Promise<{ id: bigint } | null>;
};
type RecoveryDelegate = {
  deleteMany(args: unknown): Promise<{ count: number }>;
  createMany(args: unknown): Promise<{ count: number }>;
  findMany(args: unknown): Promise<{ id: bigint; codeHash: string }[]>;
  updateMany(args: unknown): Promise<{ count: number }>;
};
type PrismaShape = {
  authenticationUser: UserDelegate;
  authenticationUserTwoFactorRecoveryCode: RecoveryDelegate;
};

@Injectable()
export class PrismaTwoFactorRecoveryCodeRepository implements TwoFactorRecoveryCodeRepository {
  private readonly users: UserDelegate;
  private readonly recoveryCodes: RecoveryDelegate;

  constructor(prisma: PrismaService) {
    const shape = prisma as unknown as PrismaShape;
    this.users = shape.authenticationUser;
    this.recoveryCodes = shape.authenticationUserTwoFactorRecoveryCode;
  }

  async replaceAll(userUuid: string, hashes: readonly string[]): Promise<void> {
    const user = await this.users.findUnique({
      where: { uuid: userUuid },
      select: { id: true },
    });
    if (!user) throw new Error('Authentication user not found');
    await this.recoveryCodes.deleteMany({ where: { userId: user.id } });
    if (hashes.length === 0) return;
    await this.recoveryCodes.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    });
  }

  async findUnused(
    userUuid: string,
  ): Promise<readonly { id: bigint; codeHash: string }[]> {
    return this.recoveryCodes.findMany({
      where: { user: { uuid: userUuid }, usedAt: null },
      select: { id: true, codeHash: true },
    });
  }

  async markUsed(id: bigint, usedAt: Date): Promise<boolean> {
    const result = await this.recoveryCodes.updateMany({
      where: { id, usedAt: null },
      data: { usedAt },
    });
    return result.count === 1;
  }
}
