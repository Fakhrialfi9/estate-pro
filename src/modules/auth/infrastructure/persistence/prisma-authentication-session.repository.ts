import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  AuthenticationSessionCreation,
  AuthenticationSessionRepository,
} from '../../domain/repositories/authentication-session.repository.js';

type Delegate = {
  create(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  findFirst(args: unknown): Promise<unknown | null>;
};

type PrismaShape = { authenticationUserSession: Delegate };

@Injectable()
export class PrismaAuthenticationSessionRepository
  implements AuthenticationSessionRepository
{
  private readonly sessions: Delegate;

  constructor(prisma: PrismaService) {
    this.sessions = (prisma as unknown as PrismaShape).authenticationUserSession;
  }

  async create(
    userUuid: string,
    session: AuthenticationSessionCreation,
  ): Promise<void> {
    await this.sessions.create({
      data: {
        user: { connect: { uuid: userUuid } },
        sessionId: session.sessionId,
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
        expiresAt: session.expiresAt,
        lastActivityAt: new Date(),
      },
    });
  }

  async revoke(userUuid: string, sessionId: string, now: Date): Promise<void> {
    await this.sessions.updateMany({
      where: {
        sessionId,
        user: { uuid: userUuid },
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
  }

  async isActive(
    userUuid: string,
    sessionId: string,
    now: Date,
  ): Promise<boolean> {
    const session = await this.sessions.findFirst({
      where: {
        sessionId,
        user: { uuid: userUuid },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { sessionId: true },
    });
    return session !== null;
  }
}
