import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  AuthenticationLockoutPolicy,
  AuthenticationSecurityRepository,
  AuthenticationSecurityState,
  SuccessfulLoginContext,
} from '../../domain/repositories/authentication-security.repository.js';

type SecurityRecord = {
  userId: bigint;
  user: { uuid: string };
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  updatedAt: Date;
};
type Delegate = {
  findFirst(args: unknown): Promise<SecurityRecord | null>;
  create(args: unknown): Promise<SecurityRecord>;
  updateMany(args: unknown): Promise<{ count: number }>;
};
type PrismaShape = { authenticationUserSecurity: Delegate };

@Injectable()
export class PrismaAuthenticationSecurityRepository implements AuthenticationSecurityRepository {
  private readonly security: Delegate;

  constructor(prisma: PrismaService) {
    this.security = (
      prisma as unknown as PrismaShape
    ).authenticationUserSecurity;
  }

  async getState(userUuid: string): Promise<AuthenticationSecurityState> {
    const existing = await this.security.findFirst({
      where: { user: { uuid: userUuid } },
      include: { user: { select: { uuid: true } } },
    });
    if (existing) return this.toState(existing);

    try {
      const created = await this.security.create({
        data: { user: { connect: { uuid: userUuid } } },
        include: { user: { select: { uuid: true } } },
      });
      return this.toState(created);
    } catch {
      const raced = await this.security.findFirst({
        where: { user: { uuid: userUuid } },
        include: { user: { select: { uuid: true } } },
      });
      if (!raced) {
        throw new Error('Unable to initialize authentication security state');
      }
      return this.toState(raced);
    }
  }

  async recordFailedLogin(
    userUuid: string,
    now: Date,
    policy: AuthenticationLockoutPolicy,
  ): Promise<AuthenticationSecurityState> {
    await this.getState(userUuid);
    const windowStart = new Date(now.getTime() - policy.windowMs);
    const reset = await this.security.updateMany({
      where: {
        user: { uuid: userUuid },
        updatedAt: { lt: windowStart },
        lockedUntil: null,
      },
      data: { failedLoginAttempts: 1 },
    });
    if (reset.count === 0) {
      await this.security.updateMany({
        where: { user: { uuid: userUuid }, lockedUntil: { lte: now } },
        data: { failedLoginAttempts: { increment: 1 } },
      });
    }
    let state = await this.getState(userUuid);
    if (
      state.failedLoginAttempts >= policy.threshold &&
      (!state.lockedUntil || state.lockedUntil <= now)
    ) {
      await this.security.updateMany({
        where: {
          user: { uuid: userUuid },
          failedLoginAttempts: { gte: policy.threshold },
          lockedUntil: null,
        },
        data: { lockedUntil: new Date(now.getTime() + policy.durationMs) },
      });
      state = await this.getState(userUuid);
    }
    return state;
  }

  async recordSuccessfulLogin(
    userUuid: string,
    now: Date,
    context: SuccessfulLoginContext,
  ): Promise<void> {
    await this.security.updateMany({
      where: {
        user: { uuid: userUuid },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
        lastLoginIp: context.ipAddress ?? null,
      },
    });
  }

  private toState(record: SecurityRecord): AuthenticationSecurityState {
    return {
      userUuid: record.user.uuid,
      failedLoginAttempts: record.failedLoginAttempts,
      lockedUntil: record.lockedUntil,
      lastLoginAt: record.lastLoginAt,
      lastLoginIp: record.lastLoginIp,
      updatedAt: record.updatedAt,
    };
  }
}
