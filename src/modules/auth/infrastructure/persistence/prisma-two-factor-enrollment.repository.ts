import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { TwoFactorEnrollmentRepository } from '../../domain/repositories/two-factor-enrollment.repository.js';

type TwoFactorDelegate = {
  updateMany(args: unknown): Promise<{ count: number }>;
};

type RecoveryDelegate = {
  deleteMany(args: unknown): Promise<{ count: number }>;
  createMany(args: unknown): Promise<{ count: number }>;
};

type UserDelegate = {
  findFirst(args: unknown): Promise<{ id: bigint } | null>;
};

type PrismaShape = {
  authenticationUser: UserDelegate;
  authenticationUserTwoFactor: TwoFactorDelegate;
  authenticationUserTwoFactorRecoveryCode: RecoveryDelegate;
  $transaction<T>(callback: (tx: PrismaShape) => Promise<T>): Promise<T>;
};

@Injectable()
export class PrismaTwoFactorEnrollmentRepository implements TwoFactorEnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enableWithRecoveryCodes(input: {
    userUuid: string;
    enabledAt: Date;
    lastUsedAt: Date;
    lastUsedTimeStep: bigint;
    recoveryCodeHashes: readonly string[];
  }): Promise<boolean> {
    const client = this.prisma as unknown as PrismaShape;

    return client.$transaction(async (tx) => {
      const user = await tx.authenticationUser.findFirst({
        where: { uuid: input.userUuid },
        select: { id: true },
      });
      if (!user) return false;

      const enabled = await tx.authenticationUserTwoFactor.updateMany({
        where: {
          userId: user.id,
          enabledAt: null,
          enrollmentStartedAt: { not: null },
        },
        data: {
          enabledAt: input.enabledAt,
          lastUsedAt: input.lastUsedAt,
          lastUsedTimeStep: input.lastUsedTimeStep,
          failedVerificationAttempts: 0,
          lockedUntil: null,
        },
      });
      if (enabled.count !== 1) return false;

      await tx.authenticationUserTwoFactorRecoveryCode.deleteMany({
        where: { userId: user.id },
      });
      if (input.recoveryCodeHashes.length > 0) {
        await tx.authenticationUserTwoFactorRecoveryCode.createMany({
          data: input.recoveryCodeHashes.map((codeHash) => ({
            userId: user.id,
            codeHash,
          })),
        });
      }

      return true;
    });
  }
}
