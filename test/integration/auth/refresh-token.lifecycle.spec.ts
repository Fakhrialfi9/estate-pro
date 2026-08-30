import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';
import { PrismaRefreshTokenRepository } from '../../../src/modules/auth/infrastructure/persistence/prisma-refresh-token.repository.js';

const config = new ConfigService({
  database: {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
    pool: {
      connectionLimit: Number(process.env.DATABASE_POOL_CONNECTION_LIMIT ?? 10),
      connectTimeoutMs: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
      acquireTimeoutMs: Number(
        process.env.DATABASE_ACQUIRE_TIMEOUT_MS ?? 10000,
      ),
      idleTimeoutSec: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_SEC ?? 300),
    },
  },
});

const generateRefreshToken = () => randomBytes(32).toString('base64url');
const digestRefreshToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');
const cryptoToken = () => generateRefreshToken();

describe('PrismaRefreshTokenRepository lifecycle', () => {
  let prisma: PrismaService;
  let repository: PrismaRefreshTokenRepository;
  let userId: bigint;
  let userUuid: string;
  let sessionId: bigint;
  let sessionSecret: string;

  beforeAll(async () => {
    prisma = new PrismaService(config);
    await prisma.$connect();
    repository = new PrismaRefreshTokenRepository(prisma);

    userUuid = randomUUID();
    const user = await prisma.authenticationUser.create({
      data: {
        uuid: userUuid,
        username: `refresh-${userUuid.slice(0, 8)}`,
        email: `refresh-${userUuid}@example.test`,
        status: 'active',
        isActive: true,
        isVerified: true,
      },
      select: { id: true },
    });
    userId = user.id;
    sessionSecret = generateRefreshToken();
    const session = await prisma.authenticationUserSession.create({
      data: {
        userId,
        sessionId: digestRefreshToken(sessionSecret),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
      select: { id: true },
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    await prisma.authenticationRefreshToken.deleteMany({
      where: { family: { user: { uuid: userUuid } } },
    });
    await prisma.authenticationRefreshTokenFamily.deleteMany({
      where: { userId },
    });
    await prisma.authenticationUserSession.deleteMany({ where: { userId } });
    await prisma.authenticationUser.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('persists only a digest, never the plaintext token', async () => {
    const plaintext = cryptoToken();
    const now = new Date();
    await repository.createWithInitialToken({
      userUuid,
      sessionId: sessionId.toString(),
      tokenHash: digestRefreshToken(plaintext),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
    });

    const persisted = await prisma.authenticationRefreshToken.findFirst({
      where: { family: { userId } },
      orderBy: { createdAt: 'desc' },
      select: { tokenHash: true },
    });
    expect(persisted?.tokenHash).toBe(digestRefreshToken(plaintext));
    expect(persisted?.tokenHash).not.toBe(plaintext);
  });

  it('rotates an active token exactly once and returns a distinct replacement', async () => {
    const plaintext = cryptoToken();
    const now = new Date();
    const created = await repository.createWithInitialToken({
      userUuid,
      sessionId: sessionId.toString(),
      tokenHash: digestRefreshToken(plaintext),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
    });

    const result = await repository.rotate(
      digestRefreshToken(plaintext),
      () => {
        const token = cryptoToken();
        return {
          token,
          tokenHash: digestRefreshToken(token),
          expiresAt: new Date(now.getTime() + 86400000),
        };
      },
      now,
    );

    expect(result.kind).toBe('ROTATED');
    if (result.kind !== 'ROTATED') return;
    expect(result.value.oldTokenId).toBe(created.tokenId);
    expect(result.value.newToken).not.toBe(plaintext);
    expect(result.value.userUuid).toBe(userUuid);
    expect(result.value.sessionId).toBe(sessionId.toString());
  });

  it('detects replay and revokes the complete family plus session', async () => {
    const plaintext = cryptoToken();
    const now = new Date();
    const created = await repository.createWithInitialToken({
      userUuid,
      sessionId: sessionId.toString(),
      tokenHash: digestRefreshToken(plaintext),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
    });

    const first = await repository.rotate(
      digestRefreshToken(plaintext),
      () => {
        const token = cryptoToken();
        return {
          token,
          tokenHash: digestRefreshToken(token),
          expiresAt: new Date(now.getTime() + 86400000),
        };
      },
      now,
    );
    expect(first.kind).toBe('ROTATED');

    const replay = await repository.rotate(
      digestRefreshToken(plaintext),
      () => {
        const token = cryptoToken();
        return {
          token,
          tokenHash: digestRefreshToken(token),
          expiresAt: new Date(now.getTime() + 86400000),
        };
      },
      new Date(now.getTime() + 1000),
    );
    expect(replay).toEqual({
      kind: 'REUSE_DETECTED',
      familyId: expect.any(String),
      userUuid,
      sessionId: sessionId.toString(),
    });

    const family = await prisma.authenticationRefreshTokenFamily.findUniqueOrThrow({
      where: { id: replay.kind === 'REUSE_DETECTED' ? replay.familyId : '' },
      select: { revokedAt: true },
    });
    expect(family.revokedAt).not.toBeNull();
    const session = await prisma.authenticationUserSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { revokedAt: true },
    });
    expect(session.revokedAt).not.toBeNull();
    expect(created.tokenId).toEqual(expect.any(String));
  });

  it('allows only one winner when the same active token is refreshed concurrently', async () => {
    const plaintext = cryptoToken();
    const now = new Date();
    await repository.createWithInitialToken({
      userUuid,
      sessionId: sessionId.toString(),
      tokenHash: digestRefreshToken(plaintext),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
    });

    const createReplacement = () => {
      const token = cryptoToken();
      return {
        token,
        tokenHash: digestRefreshToken(token),
        expiresAt: new Date(now.getTime() + 86400000),
      };
    };

    const [left, right] = await Promise.all([
      repository.rotate(digestRefreshToken(plaintext), createReplacement, now),
      repository.rotate(digestRefreshToken(plaintext), createReplacement, now),
    ]);
    const results = [left, right];
    expect(results.filter((result) => result.kind === 'ROTATED')).toHaveLength(1);
    expect(
      results.some((result) => result.kind === 'REUSE_DETECTED'),
    ).toBe(true);
  });
});
