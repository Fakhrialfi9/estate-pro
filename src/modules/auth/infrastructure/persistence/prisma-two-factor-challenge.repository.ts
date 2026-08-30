import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  TwoFactorChallengeRepository,
  TwoFactorChallengeSnapshot,
} from '../../domain/repositories/two-factor-challenge.repository.js';

type RecordShape = {
  id: bigint;
  user: { uuid: string };
  challengeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  failedAttempts: number;
  createdAt: Date;
};
type Delegate = {
  create(args: unknown): Promise<RecordShape>;
  findFirst(args: unknown): Promise<RecordShape | null>;
  updateMany(args: unknown): Promise<{ count: number }>;
};
type PrismaShape = { authenticationUserTwoFactorChallenge: Delegate };

@Injectable()
export class PrismaTwoFactorChallengeRepository implements TwoFactorChallengeRepository {
  private readonly challenges: Delegate;

  constructor(prisma: PrismaService) {
    this.challenges = (
      prisma as unknown as PrismaShape
    ).authenticationUserTwoFactorChallenge;
  }

  async create(input: {
    userUuid: string;
    challengeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.challenges.create({
      data: {
        user: { connect: { uuid: input.userUuid } },
        challengeHash: input.challengeHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findByHash(
    challengeHash: string,
  ): Promise<TwoFactorChallengeSnapshot | null> {
    const record = await this.challenges.findFirst({
      where: { challengeHash },
      include: { user: { select: { uuid: true } } },
    });
    if (!record) return null;
    return {
      id: record.id,
      userUuid: record.user.uuid,
      challengeHash: record.challengeHash,
      expiresAt: record.expiresAt,
      consumedAt: record.consumedAt,
      failedAttempts: record.failedAttempts,
      createdAt: record.createdAt,
    };
  }

  async recordFailure(id: bigint): Promise<void> {
    await this.challenges.updateMany({
      where: { id, consumedAt: null },
      data: { failedAttempts: { increment: 1 } },
    });
  }

  async consume(id: bigint, now: Date): Promise<boolean> {
    const result = await this.challenges.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return result.count === 1;
  }
}
