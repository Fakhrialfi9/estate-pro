import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
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

type LockedSecurityRecord = {
  id: bigint;
  user_uuid: string;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  last_login_ip: string | null;
  updated_at: Date;
};

type Delegate = {
  findFirst(args: unknown): Promise<SecurityRecord | null>;
  create(args: unknown): Promise<SecurityRecord>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

type PrismaShape = { authenticationUserSecurity: Delegate };

@Injectable()
export class PrismaAuthenticationSecurityRepository
  implements AuthenticationSecurityRepository
{
  private readonly security: Delegate;

  constructor(private readonly prisma: PrismaService) {
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
        await tx.authenticationUserSecurity.create({
          data: { user: { connect: { uuid: userUuid } } },
        });

        const [created] = await tx.$queryRaw<LockedSecurityRecord[]>(
          Prisma.sql`
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
          `,
        );

        if (!created) {
          throw new Error('Unable to initialize authentication security state');
        }

        const next = this.nextFailedLoginState(created, now, policy);
        const updated = await tx.authenticationUserSecurity.update({
          where: { id: created.id },
          data: {
            failedLoginAttempts: next.failedLoginAttempts,
            lockedUntil: next.lockedUntil,
          },
          include: { user: { select: { uuid: true } } },
        });
        return this.toState(updated);
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
      current.updated_at < windowStart
        ? 1
        : current.failed_login_attempts + 1;

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
