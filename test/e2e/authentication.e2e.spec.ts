import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response as SuperTestResponse } from 'supertest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';

const PASSWORD = 'Strong-Test-Password-123!';

type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

type MeResponse = {
  uuid: string;
  passwordHash?: string;
};

type SessionsResponse = {
  data: Array<{ id: string }>;
};

type ErrorResponse = {
  message: string;
};

type SuperTestApp = Parameters<typeof request>[0];

let app: NestExpressApplication;
let prisma: PrismaService;
let hasher: PasswordHasherService;
let jwt: JwtService;
let config: ConfigService;
let userUuid: string;

const httpRequest = () => {
  const server = app.getHttpServer() as unknown as SuperTestApp;
  return request(server);
};
const bodyOf = <T>(response: SuperTestResponse): T => {
  const body: unknown = response.body;
  return body as T;
};

async function createActiveUser(
  email = `auth-${randomUUID()}@example.com`,
): Promise<void> {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email,
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

describe('Authentication E2E', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    hasher = app.get(PasswordHasherService);
    jwt = app.get(JwtService);
    config = app.get(ConfigService);
  });

  beforeEach(async () => {
    await cleanup();
    await createActiveUser();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('logs in, establishes a session, authenticates /me, then logs out the current session', async () => {
    const user = await prisma.authenticationUser.findUniqueOrThrow({
      where: { uuid: userUuid },
    });
    const valid = await httpRequest()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '10.20.0.1')
      .set('User-Agent', 'estate-pro-e2e')
      .set('X-Request-ID', 'auth-login-success')
      .send({ identifier: user.email, password: PASSWORD })
      .expect(201);
    const result = bodyOf<LoginResponse>(valid);
    expect(result.tokenType).toBe('Bearer');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.expiresIn).toBeGreaterThan(0);

    const me = await httpRequest()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .expect(200);
    const meBody = bodyOf<MeResponse>(me);
    expect(meBody.uuid).toBe(userUuid);
    expect(meBody.passwordHash).toBeUndefined();

    const sessions = await httpRequest()
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .expect(200);
    const sessionsBody = bodyOf<SessionsResponse>(sessions);
    expect(Array.isArray(sessionsBody.data)).toBe(true);
    expect(sessionsBody.data).toHaveLength(1);

    await httpRequest()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .expect(201);

    await httpRequest()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .expect(401);

    expect(
      await prisma.auditLog.count({
        where: { action: 'LOGIN_SUCCESS', userId: user.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'LOGOUT', userId: user.id },
      }),
    ).toBe(1);
  });

  it('rejects invalid credentials without revealing account existence', async () => {
    const user = await prisma.authenticationUser.findUniqueOrThrow({
      where: { uuid: userUuid },
    });
    await httpRequest()
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password: 'Wrong-Password-123!' })
      .expect(401);
    const unknown = await httpRequest()
      .post('/api/v1/auth/login')
      .send({
        identifier: 'missing@example.com',
        password: 'Wrong-Password-123!',
      })
      .expect(401);
    const unknownBody = bodyOf<ErrorResponse>(unknown);
    expect(unknownBody.message).toBe('Invalid credentials');
    expect(
      await prisma.auditLog.count({ where: { action: 'LOGIN_FAILURE' } }),
    ).toBe(2);
  });

  it('rejects malformed and expired JWTs at the real authentication boundary', async () => {
    await httpRequest()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);

    const expired = jwt.sign(
      { sub: userUuid, sid: randomUUID() },
      {
        secret: config.getOrThrow<string>('auth.jwt.secret'),
        issuer: config.getOrThrow<string>('auth.jwt.issuer'),
        audience: config.getOrThrow<string>('auth.jwt.audience'),
        algorithm: config.getOrThrow<string>('auth.jwt.algorithm') as 'HS256',
        expiresIn: -1,
      },
    );
    await httpRequest()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('revokes an owned session through the session API and records the security event', async () => {
    const user = await prisma.authenticationUser.findUniqueOrThrow({
      where: { uuid: userUuid },
    });
    const login = await httpRequest()
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password: PASSWORD })
      .expect(201);
    const token = bodyOf<LoginResponse>(login).accessToken;
    const sessions = await httpRequest()
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const sessionsBody = bodyOf<SessionsResponse>(sessions);
    const sessionId = sessionsBody.data[0]?.id;
    expect(sessionId).toMatch(/^\d+$/);

    await httpRequest()
      .delete(`/api/v1/auth/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await httpRequest()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(
      await prisma.auditLog.count({
        where: { action: 'SESSION_REVOKED', userId: user.id },
      }),
    ).toBe(1);
  });
});
