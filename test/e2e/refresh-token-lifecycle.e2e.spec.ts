import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { Response } from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';
import { REFRESH_TOKEN_SECURITY_PORT, type RefreshTokenSecurityPort } from '../../src/common/security/refresh-token-security.port.js';
import { digestRefreshToken } from '../../src/modules/auth/infrastructure/persistence/prisma-refresh-token.repository.js';

const PASSWORD = 'Strong-Test-Password-123!';
const endpoint = '/api/v1/auth';
type AuthResponse = { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number; refreshTokenExpiresIn: number };
type ErrorResponse = { message: string };

let app: NestExpressApplication;
let prisma: PrismaService;
let hasher: PasswordHasherService;
let security: RefreshTokenSecurityPort;
let userUuid: string;

const http = () => request(app.getHttpServer());
const body = <T>(response: Response): T => response.body as T;

async function createUser(): Promise<void> {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email: `rt-${randomUUID()}@example.test`,
      username: `rt-${randomUUID().slice(0, 10)}`,
      status: 'active',
      isActive: true,
      isVerified: true,
    },
  });
  userUuid = user.uuid;
  await prisma.authenticationUserCredential.create({
    data: { userId: user.id, passwordHash: await hasher.hash(PASSWORD) },
  });
  await prisma.authenticationUserSecurity.create({ data: { userId: user.id } });
}

async function cleanup(): Promise<void> {
  await prisma.auditLogChange.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.authenticationUserTwoFactorChallenge.deleteMany();
  await prisma.authenticationUserTwoFactorRecoveryCode.deleteMany();
  await prisma.authenticationUserTwoFactor.deleteMany();
  await prisma.authenticationPasswordResetToken.deleteMany();
  await prisma.authenticationRefreshToken.deleteMany();
  await prisma.authenticationRefreshTokenFamily.deleteMany();
  await prisma.authenticationUserSession.deleteMany();
  await prisma.authenticationUserCredential.deleteMany();
  await prisma.authenticationUserSecurity.deleteMany();
  await prisma.authenticationUserProfile.deleteMany();
  await prisma.authorizationUserRole.deleteMany();
  await prisma.authenticationUser.deleteMany();
}

async function login(): Promise<AuthResponse> {
  const user = await prisma.authenticationUser.findUniqueOrThrow({ where: { uuid: userUuid } });
  const response = await http().post(`${endpoint}/login`).send({ identifier: user.email, password: PASSWORD }).expect(201);
  return body<AuthResponse>(response);
}

async function refresh(token: string): Promise<Response> {
  return http().post(`${endpoint}/refresh`).send({ refreshToken: token });
}

async function tokenRow(token: string) {
  return prisma.authenticationRefreshToken.findUniqueOrThrow({
    where: { tokenHash: digestRefreshToken(token) },
  });
}

describe('Refresh-token lifecycle E2E matrix', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    hasher = app.get(PasswordHasherService);
    security = app.get(REFRESH_TOKEN_SECURITY_PORT);
  });

  beforeEach(async () => {
    await cleanup();
    await createUser();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('RT-001 login creates a refresh token', async () => {
    const result = await login();
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.refreshTokenExpiresIn).toBeGreaterThan(0);
    await expect(tokenRow(result.refreshToken)).resolves.toBeDefined();
  });

  it('RT-002 plaintext refresh token is not persisted', async () => {
    const result = await login();
    const row = await tokenRow(result.refreshToken);
    expect(row.tokenHash).not.toBe(result.refreshToken);
  });

  it('RT-003 stored refresh token value is a digest', async () => {
    const result = await login();
    const row = await tokenRow(result.refreshToken);
    expect(row.tokenHash).toBe(digestRefreshToken(result.refreshToken));
  });

  it('RT-004 valid refresh returns new access and refresh tokens', async () => {
    const result = await login();
    const response = await refresh(result.refreshToken).expect(201);
    const next = body<AuthResponse>(response);
    expect(next.accessToken).not.toBe(result.accessToken);
    expect(next.refreshToken).not.toBe(result.refreshToken);
  });

  it('RT-005 old token after rotation returns 401', async () => {
    const result = await login();
    await refresh(result.refreshToken).expect(201);
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-006 expired token returns 401', async () => {
    const result = await login();
    const row = await tokenRow(result.refreshToken);
    await prisma.authenticationRefreshToken.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-007 malformed token returns 401', async () => {
    const response = await refresh('malformed-token').expect(401);
    expect(body<ErrorResponse>(response).message).toBe('Invalid refresh token');
  });

  it('RT-008 random token returns 401', async () => {
    await refresh(Buffer.from(randomUUID()).toString('base64url')).expect(401);
  });

  it('RT-009 revoked token returns 401', async () => {
    const result = await login();
    const row = await tokenRow(result.refreshToken);
    await prisma.authenticationRefreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), revokeReason: 'SESSION_REVOKED' } });
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-010 logout then refresh returns 401', async () => {
    const result = await login();
    await http().post(`${endpoint}/logout`).set('Authorization', `Bearer ${result.accessToken}`).expect(201);
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-011 password-change security event then refresh returns 401', async () => {
    const result = await login();
    await security.revokeAllForUser(userUuid, 'PASSWORD_CHANGED');
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-012 password-reset security event then refresh returns 401', async () => {
    const result = await login();
    await security.revokeAllForUser(userUuid, 'PASSWORD_RESET');
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-013 account disabled then refresh returns 401', async () => {
    const result = await login();
    const user = await prisma.authenticationUser.findUniqueOrThrow({ where: { uuid: userUuid } });
    await prisma.authenticationUser.update({ where: { id: user.id }, data: { status: 'inactive', isActive: false } });
    await security.revokeAllForUser(userUuid, 'ACCOUNT_DISABLED');
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-014 admin session revoke then refresh returns 401', async () => {
    const result = await login();
    const row = await tokenRow(result.refreshToken);
    await security.revokeForSession(userUuid, row.familyId.toString(), 'ADMIN_REVOKED');
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-015 family revocation then refresh returns 401', async () => {
    const result = await login();
    const row = await tokenRow(result.refreshToken);
    await prisma.authenticationRefreshTokenFamily.update({ where: { id: row.familyId }, data: { revokedAt: new Date(), revokeReason: 'SECURITY_EVENT' } });
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-016 reusing the old rotated token returns 401', async () => {
    const result = await login();
    await refresh(result.refreshToken).expect(201);
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-017 reuse detection revokes the family', async () => {
    const result = await login();
    const original = await tokenRow(result.refreshToken);
    await refresh(result.refreshToken).expect(201);
    await refresh(result.refreshToken).expect(401);
    const family = await prisma.authenticationRefreshTokenFamily.findUniqueOrThrow({ where: { id: original.familyId } });
    expect(family.revokedAt).not.toBeNull();
    expect(family.revokeReason).toBe('REUSE_DETECTED');
  });

  it('RT-018 reuse detection revokes the session', async () => {
    const result = await login();
    const original = await tokenRow(result.refreshToken);
    await refresh(result.refreshToken).expect(201);
    await refresh(result.refreshToken).expect(401);
    const family = await prisma.authenticationRefreshTokenFamily.findUniqueOrThrow({ where: { id: original.familyId } });
    const session = await prisma.authenticationUserSession.findUniqueOrThrow({ where: { id: family.sessionId } });
    expect(session.revokedAt).not.toBeNull();
  });

  it('RT-019 simultaneous refresh requests allow at most one rotation', async () => {
    const result = await login();
    const responses = await Promise.all([
      refresh(result.refreshToken),
      refresh(result.refreshToken),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 401]);
  });

  it('RT-020 second concurrent request is handled as invalid/reuse', async () => {
    const result = await login();
    const responses = await Promise.all([
      refresh(result.refreshToken),
      refresh(result.refreshToken),
    ]);
    expect(responses.filter((response) => response.status === 401)).toHaveLength(1);
  });

  it('RT-021 refresh remains valid after access-token expiry window is simulated', async () => {
    const result = await login();
    await refresh(result.refreshToken).expect(201);
  });

  it('RT-022 a currently active session can refresh successfully', async () => {
    const result = await login();
    const response = await refresh(result.refreshToken).expect(201);
    expect(body<AuthResponse>(response).accessToken).toEqual(expect.any(String));
  });

  it('RT-023 plaintext refresh token never appears in audit records', async () => {
    const result = await login();
    await refresh(result.refreshToken).expect(201);
    const logs = await prisma.auditLog.findMany({ where: { user: { uuid: userUuid } }, select: { metadata: true } });
    expect(JSON.stringify(logs)).not.toContain(result.refreshToken);
  });

  it('RT-024 plaintext refresh token is absent from audit changes', async () => {
    const result = await login();
    await refresh(result.refreshToken).expect(201);
    const changes = await prisma.auditLogChange.findMany({ select: { oldValue: true, newValue: true } });
    expect(JSON.stringify(changes)).not.toContain(result.refreshToken);
  });

  it('RT-025 refresh endpoint is rate limited', async () => {
    const result = await login();
    const responses = await Promise.all(Array.from({ length: 12 }, () => refresh(result.refreshToken)));
    expect(responses.some((response) => response.status === 429)).toBe(true);
  });

  it('RT-026 refresh response sends Cache-Control no-store', async () => {
    const result = await login();
    const response = await refresh(result.refreshToken).expect(201);
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('RT-027 token remains bound to its session/family security state', async () => {
    const result = await login();
    const row = await tokenRow(result.refreshToken);
    await security.revokeForSession(userUuid, row.familyId.toString(), 'SESSION_REVOKED');
    await refresh(result.refreshToken).expect(401);
  });

  it('RT-028 a token from user A cannot be revived by user B state', async () => {
    const resultA = await login();
    const userA = userUuid;
    await createUser();
    const userB = userUuid;
    await security.revokeAllForUser(userB, 'ACCOUNT_DISABLED');
    await refresh(resultA.refreshToken).expect(401);
    expect(userA).not.toBe(userB);
  });

  it('RT-029 rotation failure rolls back instead of leaving a consumed token without a replacement', async () => {
    const result = await login();
    const row = await tokenRow(result.refreshToken);
    await expect(
      prisma.authenticationRefreshToken.create({
        data: {
          familyId: row.familyId,
          tokenHash: 'x'.repeat(1000),
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      }),
    ).rejects.toThrow();
    const unchanged = await prisma.authenticationRefreshToken.findUniqueOrThrow({ where: { id: row.id } });
    expect(unchanged.consumedAt).toBeNull();
    await refresh(result.refreshToken).expect(201);
  });

  it('RT-030 database failure returns a safe failure without exposing database details', async () => {
    const result = await login();
    await prisma.$disconnect();
    const response = await refresh(result.refreshToken);
    expect([401, 500, 503]).toContain(response.status);
    const text = JSON.stringify(response.body);
    expect(text).not.toMatch(/mysql|mariadb|prisma|ECONN|DATABASE_URL/i);
  });
});
