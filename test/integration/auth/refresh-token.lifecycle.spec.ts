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
    const replacement = cryptoToken();
    const result = await repository.rotate(
      digestRefreshToken(plaintext),
      () => ({
        token: replacement,
        tokenHash: digestRefreshToken(replacement),
        expiresAt: new Date(now.getTime() + 86400000),
      }),
      now,
    );

    expect(result.kind).toBe('ROTATED');
    if (result.kind === 'ROTATED') {
      expect(result.value.oldTokenId).toBe(created.tokenId);
      expect(result.value.newToken).toBe(replacement);
      expect(result.value.userUuid).toBe(userUuid);
      expect(result.value.sessionId).toBe(sessionId.toString());
    }

    const old = await prisma.authenticationRefreshToken.findUnique({
      where: { id: BigInt(created.tokenId) },
      select: { consumedAt: true, revokedAt: true, revokeReason: true },
    });
    expect(old?.consumedAt).not.toBeNull();
    expect(old?.revokedAt).not.toBeNull();
    expect(old?.revokeReason).toBe('ROTATED');
  });

  it('detects replay and revokes the complete family plus session', async () => {
    const plaintext = cryptoToken();
    const now = new Date();
    await repository.createWithInitialToken({
      userUuid,
      sessionId: sessionId.toString(),
      tokenHash: digestRefreshToken(plaintext),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
    });
    const firstReplacement = cryptoToken();
    const first = await repository.rotate(
      digestRefreshToken(plaintext),
      () => ({
        token: firstReplacement,
        tokenHash: digestRefreshToken(firstReplacement),
        expiresAt: new Date(now.getTime() + 86400000),
      }),
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
      new Date(now.getTime() + 1),
    );
    expect(replay.kind).toBe('REUSE_DETECTED');

    const familyId =
      first.kind === 'ROTATED' ? first.value.familyId : undefined;
    expect(familyId).toBeDefined();
    const family = await prisma.authenticationRefreshTokenFamily.findUnique({
      where: { id: familyId },
    });
    const session = await prisma.authenticationUserSession.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true },
    });
    expect(family?.revokedAt).not.toBeNull();
    expect(family?.revokeReason).toBe('REUSE_DETECTED');
    expect(session?.revokedAt).not.toBeNull();
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

    const outcomes = await Promise.allSettled(
      [1, 2].map(async () => {
        const replacement = cryptoToken();
        return repository.rotate(
          digestRefreshToken(plaintext),
          () => ({
            token: replacement,
            tokenHash: digestRefreshToken(replacement),
            expiresAt: new Date(now.getTime() + 86400000),
          }),
          now,
        );
      }),
    );
    const values = outcomes
      .filter(
        (
          outcome,
        ): outcome is PromiseFulfilledResult<
          Awaited<ReturnType<PrismaRefreshTokenRepository['rotate']>>
        > => outcome.status === 'fulfilled',
      )
      .map((outcome) => outcome.value);
    const winners = values.filter((value) => value.kind === 'ROTATED');
    const reuses = values.filter((value) => value.kind === 'REUSE_DETECTED');
    expect(winners.length).toBeLessThanOrEqual(1);
    expect(reuses.length).toBeLessThanOrEqual(1);
    expect(winners.length + reuses.length).toBe(2);
  });
});
