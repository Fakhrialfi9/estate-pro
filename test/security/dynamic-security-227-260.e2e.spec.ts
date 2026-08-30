import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';

const PASSWORD = 'Strong-Test-Password-123!';
const AUTH = '/api/v1/auth';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshTokenExpiresIn: number;
};

let app: NestExpressApplication;
let prisma: PrismaService;
let hasher: PasswordHasherService;

const http = () => request(app.getHttpServer());

async function createUser(): Promise<{ uuid: string; email: string }> {
  const email = `dynamic-${randomUUID()}@example.test`;
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email,
      username: `dynamic-${randomUUID().slice(0, 12)}`,
      status: 'active',
      isActive: true,
      isVerified: true,
    },
  });
  await prisma.authenticationUserCredential.create({
    data: { userId: user.id, passwordHash: await hasher.hash(PASSWORD) },
  });
  await prisma.authenticationUserSecurity.create({ data: { userId: user.id } });
  return { uuid: user.uuid, email };
}

async function cleanup(): Promise<void> {
  await prisma.auditLogChange.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.authenticationRefreshToken.deleteMany();
  await prisma.authenticationRefreshTokenFamily.deleteMany();
  await prisma.authenticationUserSession.deleteMany();
  await prisma.authenticationUserCredential.deleteMany();
  await prisma.authenticationUserSecurity.deleteMany();
  await prisma.authenticationUser.deleteMany();
}

describe('Dynamic HTTP security baseline — STEPS 227–260', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    hasher = app.get(PasswordHasherService);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('blocks unauthenticated access and rejects injection/mass-assignment payloads at the HTTP boundary', async () => {
    await http().get(`${AUTH}/me`).expect(401);
    const injection = await http().post(`${AUTH}/login`).send({
      identifier: "admin' OR '1'='1",
      password: '<script>alert(1)</script>',
    });
    expect(injection.status).toBe(401);
    expect(JSON.stringify(injection.body)).not.toContain("admin' OR '1'='1");
    expect(JSON.stringify(injection.body)).not.toContain(
      '<script>alert(1)</script>',
    );
    await http()
      .post(`${AUTH}/login`)
      .send({
        identifier: 'nobody@example.test',
        password: PASSWORD,
        role: 'admin',
        permissions: ['*'],
      })
      .expect(400);
  });

  it('performs real refresh rotation, logout invalidation, and replay detection over HTTP', async () => {
    const user = await createUser();
    const login = await http()
      .post(`${AUTH}/login`)
      .send({ identifier: user.email, password: PASSWORD })
      .expect(201);
    const first = login.body as AuthResponse;
    const rotated = await http()
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    const second = rotated.body as AuthResponse;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);

    await http()
      .post(`${AUTH}/logout`)
      .set('Authorization', `Bearer ${second.accessToken}`)
      .expect(201);
    await http()
      .get(`${AUTH}/me`)
      .set('Authorization', `Bearer ${second.accessToken}`)
      .expect(401);
    await http()
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: second.refreshToken })
      .expect(401);

    await http()
      .post(`${AUTH}/refresh`)
      .send({ refreshToken: first.refreshToken })
      .expect(401);
  });

  it('does not use an ambient cookie credential for refresh and keeps the refresh response non-cacheable', async () => {
    const user = await createUser();
    const login = await http()
      .post(`${AUTH}/login`)
      .send({ identifier: user.email, password: PASSWORD })
      .expect(201);
    const auth = login.body as AuthResponse;
    const response = await http()
      .post(`${AUTH}/refresh`)
      .set('Origin', 'https://attacker.example')
      .send({ refreshToken: auth.refreshToken })
      .expect(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['cache-control']).toContain('no-store');
  });
});
