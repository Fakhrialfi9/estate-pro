import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import type {
  AuthenticationLockoutPolicy,
  AuthenticationSecurityRepository,
  AuthenticationSecurityState,
  SuccessfulLoginContext,
} from '../../domain/repositories/authentication-security.repository.js';

type SecurityRecord = Prisma.AuthenticationUserSecurityGetPayload<{
  include: { user: { select: { uuid: true } } };
}>;

type LockedSecurityRecord = {
  id: bigint;
  user_uuid: string;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  last_login_ip: string | null;
  updated_at: Date;
};

@Injectable()
export class PrismaAuthenticationSecurityRepository
  implements AuthenticationSecurityRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async getState(userUuid: string): Promise<AuthenticationSecurityState> {
    const existing = await this.prisma.authenticationUserSecurity.findFirst({
      where: { user: { uuid: userUuid } },
      include: { user: { select: { uuid: true } } },
    });
    if (existing) return this.toState(existing);

    try {
      const created = await this.prisma.authenticationUserSecurity.create({
        data: { user: { connect: { uuid: userUuid } } },
        include: { user: { select: { uuid: true } } },
      });
      return this.toState(created);
    } catch (error: unknown) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }

      const raced = await this.prisma.authenticationUserSecurity.findFirst({
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

    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<LockedSecurityRecord[]>(Prisma.sql`
        SELECT
          s.id,
          u.uuid AS user_uuid,
          s.failed_login_attempts,
          s.locked_until,
          s.last_login_at,
          s.last_login_ip,
          s.updated_at
        FROM authentication_user_security s
        INNER JOIN authentication_users u ON u.id = s.user_id
        WHERE u.uuid = ${userUuid}
        LIMIT 1
        FOR UPDATE
      `);

      if (!locked) {
        throw new Error(
          'Authentication security state disappeared during update',
        );
      }

      const next = this.nextFailedLoginState(locked, now, policy);
      const updated = await tx.authenticationUserSecurity.update({
        where: { id: locked.id },
        data: {
          failedLoginAttempts: next.failedLoginAttempts,
          lockedUntil: next.lockedUntil,
        },
        include: { user: { select: { uuid: true } } },
      });
      return this.toState(updated);
    });
  }

  async recordSuccessfulLogin(
    userUuid: string,
    now: Date,
    context: SuccessfulLoginContext,
  ): Promise<void> {
    await this.prisma.authenticationUserSecurity.updateMany({
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

  private nextFailedLoginState(
    current: LockedSecurityRecord,
    now: Date,
    policy: AuthenticationLockoutPolicy,
  ): { failedLoginAttempts: number; lockedUntil: Date | null } {
    const windowStart = new Date(now.getTime() - policy.windowMs);

    if (current.locked_until !== null && current.locked_until > now) {
      return {
        failedLoginAttempts: current.failed_login_attempts,
        lockedUntil: current.locked_until,
      };
    }

    const failedLoginAttempts =
      current.updated_at < windowStart ? 1 : current.failed_login_attempts + 1;

    const lockedUntil =
      failedLoginAttempts >= policy.threshold
        ? new Date(now.getTime() + policy.durationMs)
        : null;

    return { failedLoginAttempts, lockedUntil };
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
