import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  AuthenticationSessionCreation,
  AuthenticationSessionRepository,
  SessionListQuery,
} from '../../domain/repositories/authentication-session.repository.js';
import type { SessionSnapshot } from '../../domain/entities/session.entity.js';

type SessionRow = {
  id: bigint;
  sessionId: string;
  userId: bigint;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  user: { uuid: string };
};

type SessionDelegate = {
  create(args: unknown): Promise<SessionRow>;
  findFirst(args: unknown): Promise<SessionRow | null>;
  findMany(args: unknown): Promise<SessionRow[]>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

type PrismaShape = { authenticationUserSession: SessionDelegate };

@Injectable()
export class PrismaAuthenticationSessionRepository
  implements AuthenticationSessionRepository
{
  private readonly sessions: SessionDelegate;

  constructor(prisma: PrismaService) {
    this.sessions = (
      prisma as unknown as PrismaShape
    ).authenticationUserSession;
  }

  async create(
    userUuid: string,
    session: AuthenticationSessionCreation,
  ): Promise<SessionSnapshot> {
    const row = await this.sessions.create({
      data: {
        user: { connect: { uuid: userUuid } },
        sessionId: this.digest(session.sessionId),
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
        expiresAt: session.expiresAt,
        lastActivityAt: new Date(),
      },
      include: { user: { select: { uuid: true } } },
    });
    return this.toSnapshot(row);
  }

  async findBySecret(
    userUuid: string,
    sessionId: string,
  ): Promise<SessionSnapshot | null> {
    const row = await this.sessions.findFirst({
      where: { sessionId: this.digest(sessionId), user: { uuid: userUuid } },
      include: { user: { select: { uuid: true } } },
    });
    return row ? this.toSnapshot(row) : null;
  }

  async findById(
    userUuid: string,
    id: string,
  ): Promise<SessionSnapshot | null> {
    const row = await this.sessions.findFirst({
      where: { id: this.toBigInt(id), user: { uuid: userUuid } },
      include: { user: { select: { uuid: true } } },
    });
    return row ? this.toSnapshot(row) : null;
  }

  async list(
    userUuid: string,
    query: SessionListQuery,
  ): Promise<SessionSnapshot[]> {
    const rowFilter = query.includeInactive
      ? {}
      : { revokedAt: null, expiresAt: { gt: new Date() } };
    const rows = await this.sessions.findMany({
      where: { user: { uuid: userUuid }, ...rowFilter },
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit,
      include: { user: { select: { uuid: true } } },
    });
    return rows.map((row) => this.toSnapshot(row));
  }

  async revokeBySecret(
    userUuid: string,
    sessionId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.sessions.updateMany({
      where: {
        sessionId: this.digest(sessionId),
        user: { uuid: userUuid },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });
    return result.count > 0;
  }

  async revokeById(userUuid: string, id: string, now: Date): Promise<boolean> {
    const result = await this.sessions.updateMany({
      where: {
        id: this.toBigInt(id),
        user: { uuid: userUuid },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });
    return result.count > 0;
  }

  async revokeAll(userUuid: string, now: Date): Promise<number> {
    const result = await this.sessions.updateMany({
      where: {
        user: { uuid: userUuid },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });
    return result.count;
  }

  async isActive(
    userUuid: string,
    sessionId: string,
    now: Date,
  ): Promise<boolean> {
    const row = await this.sessions.findFirst({
      where: {
        sessionId: this.digest(sessionId),
        user: { uuid: userUuid },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    return row !== null;
  }

  private digest(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private toBigInt(value: string): bigint {
    if (!/^\d+$/.test(value)) throw new Error('Invalid session identifier');
    return BigInt(value);
  }

  private toSnapshot(row: SessionRow): SessionSnapshot {
    return {
      id: row.id.toString(),
      userUuid: row.user.uuid,
      sessionIdHash: row.sessionId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      lastActivityAt: row.lastActivityAt,
      revokedAt: row.revokedAt,
      expiresAt: row.expiresAt,
    };
  }
}
