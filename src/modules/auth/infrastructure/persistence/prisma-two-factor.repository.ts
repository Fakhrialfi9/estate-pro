import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { TwoFactorSnapshot } from '../../domain/entities/two-factor.entity.js';
import type { TwoFactorRepository } from '../../domain/repositories/two-factor.repository.js';

type RecordShape = {
  id: bigint;
  userId: bigint;
  user: { uuid: string };
  method: string;
  secretEncrypted: string;
  enabledAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedTimeStep: bigint | null;
  enrollmentStartedAt: Date | null;
  failedVerificationAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type Delegate = {
  findFirst(args: unknown): Promise<RecordShape | null>;
  create(args: unknown): Promise<RecordShape>;
  updateMany(args: unknown): Promise<{ count: number }>;
};
type PrismaShape = { authenticationUserTwoFactor: Delegate };

@Injectable()
export class PrismaTwoFactorRepository implements TwoFactorRepository {
  private readonly twoFactor: Delegate;

  constructor(prisma: PrismaService) {
    this.twoFactor = (prisma as unknown as PrismaShape).authenticationUserTwoFactor;
  }

  async findByUserUuid(userUuid: string): Promise<TwoFactorSnapshot | null> {
    const record = await this.twoFactor.findFirst({
      where: { user: { uuid: userUuid } },
      include: { user: { select: { uuid: true } } },
    });
    return record ? this.toSnapshot(record) : null;
  }

  async createPending(input: { userUuid: string; secretEncrypted: string; startedAt: Date }): Promise<TwoFactorSnapshot> {
    await this.twoFactor.updateMany({
      where: { user: { uuid: input.userUuid }, enabledAt: null },
      data: { secretEncrypted: input.secretEncrypted, enrollmentStartedAt: input.startedAt, failedVerificationAttempts: 0, lockedUntil: null },
    });
    const existing = await this.findByUserUuid(input.userUuid);
    if (existing) return existing;
    const created = await this.twoFactor.create({
      data: { user: { connect: { uuid: input.userUuid } }, method: 'totp', secretEncrypted: input.secretEncrypted, enrollmentStartedAt: input.startedAt },
      include: { user: { select: { uuid: true } } },
    });
    return this.toSnapshot(created);
  }

  async enable(input: { userUuid: string; enabledAt: Date; lastUsedAt: Date; lastUsedTimeStep: bigint }): Promise<boolean> {
    const result = await this.twoFactor.updateMany({
      where: { user: { uuid: input.userUuid }, enabledAt: null, enrollmentStartedAt: { not: null } },
      data: { enabledAt: input.enabledAt, lastUsedAt: input.lastUsedAt, lastUsedTimeStep: input.lastUsedTimeStep, failedVerificationAttempts: 0, lockedUntil: null },
    });
    return result.count === 1;
  }

  async disable(userUuid: string): Promise<void> {
    await this.twoFactor.updateMany({
      where: { user: { uuid: userUuid } },
      data: { enabledAt: null, secretEncrypted: '', enrollmentStartedAt: null, lastUsedAt: null, lastUsedTimeStep: null, failedVerificationAttempts: 0, lockedUntil: null },
    });
  }

  async recordFailedVerification(input: { userUuid: string; now: Date; threshold: number; lockDurationMs: number }): Promise<void> {
    const state = await this.findByUserUuid(input.userUuid);
    if (!state) return;
    if (state.lockedUntil && state.lockedUntil > input.now) return;
    await this.twoFactor.updateMany({
      where: { user: { uuid: input.userUuid }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: input.now } }] },
      data: { failedVerificationAttempts: { increment: 1 } },
    });
    const latest = await this.findByUserUuid(input.userUuid);
    if (latest && latest.failedVerificationAttempts >= input.threshold) {
      await this.twoFactor.updateMany({ where: { user: { uuid: input.userUuid } }, data: { lockedUntil: new Date(input.now.getTime() + input.lockDurationMs) } });
    }
  }

  async recordSuccessfulVerification(input: { userUuid: string; now: Date; timeStep: bigint }): Promise<boolean> {
    const result = await this.twoFactor.updateMany({
      where: {
        user: { uuid: input.userUuid },
        enabledAt: { not: null },
        OR: [{ lastUsedTimeStep: null }, { lastUsedTimeStep: { lt: input.timeStep } }],
      },
      data: { lastUsedAt: input.now, lastUsedTimeStep: input.timeStep, failedVerificationAttempts: 0, lockedUntil: null },
    });
    return result.count === 1;
  }

  private toSnapshot(record: RecordShape): TwoFactorSnapshot {
    return { id: record.id, userUuid: record.user.uuid, method: record.method, secretEncrypted: record.secretEncrypted, enabledAt: record.enabledAt, lastUsedAt: record.lastUsedAt, lastUsedTimeStep: record.lastUsedTimeStep, enrollmentStartedAt: record.enrollmentStartedAt, failedVerificationAttempts: record.failedVerificationAttempts, lockedUntil: record.lockedUntil, createdAt: record.createdAt, updatedAt: record.updatedAt };
  }
}
