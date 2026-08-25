import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response as SuperTestResponse } from 'supertest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';
import { JwtService } from '@nestjs/jwt';

const PASSWORD = 'Strong-Test-Password-123!';
type UserResponse = {
  uuid: string;
  email: string;
  password?: string;
  passwordHash?: string;
};
type UserListResponse = { items: Array<{ uuid: string }> };
type ProfileResponse = { firstName: string; locale: string };
type LoginResponse = { accessToken: string };

let app: NestExpressApplication;
let prisma: PrismaService;
let hasher: PasswordHasherService;
let jwt: JwtService;
let actorUuid = '';
let targetUuid = '';

const httpRequest = () => request(app.getHttpServer());
const bodyOf = <T>(response: SuperTestResponse): T =>
  response.body as unknown as T;

async function tokenFor(
  sub: string,
  permissions: string[] = ['users:manage'],
): Promise<string> {
  const user = await prisma.authenticationUser.findUniqueOrThrow({
    where: { uuid: sub },
    select: { id: true },
  });
  const sessionId = randomUUID();
  await prisma.authenticationUserSession.create({
    data: {
      userId: user.id,
      sessionId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return jwt.sign({ sub, sid: sessionId, permissions });
}

async function createUser(
  email: string,
): Promise<{ id: bigint; uuid: string }> {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email,
      status: 'active',
      isActive: true,
      isVerified: true,
    },
  });
  await prisma.authenticationUserSecurity.create({ data: { userId: user.id } });
  await prisma.authenticationUserCredential.create({
    data: { userId: user.id, passwordHash: await hasher.hash(PASSWORD) },
  });
  return { id: user.id, uuid: user.uuid };
}

async function cleanup(): Promise<void> {
  await prisma.auditLogChange.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.authenticationUserTwoFactorChallenge.deleteMany();
  await prisma.authenticationUserTwoFactorRecoveryCode.deleteMany();
  await prisma.authenticationUserTwoFactor.deleteMany();
  await prisma.authenticationUserSession.deleteMany();
  await prisma.authenticationUserCredential.deleteMany();
  await prisma.authenticationUserSecurity.deleteMany();
  await prisma.authenticationUserProfile.deleteMany();
  await prisma.authenticationUser.deleteMany();
}

describe('User management E2E', () => {
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
  });

  beforeEach(async () => {
    await cleanup();
    const actor = await createUser(`manager-${randomUUID()}@example.com`);
    const target = await createUser(`target-${randomUUID()}@example.com`);
    actorUuid = actor.uuid;
    targetUuid = target.uuid;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('creates, reads, searches, updates and deactivates a user with database side effects', async () => {
    const token = await tokenFor(actorUuid);
    const create = await httpRequest()
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: `created-${randomUUID().slice(0, 8)}`,
        email: `created-${randomUUID()}@example.com`,
      })
      .expect(201);
    const createBody = bodyOf<UserResponse>(create);
    const uuid = createBody.uuid;
    expect(createBody.password).toBeUndefined();
    expect(createBody.passwordHash).toBeUndefined();

    await httpRequest()
      .get(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const list = await httpRequest()
      .get(
        `/api/v1/users?page=1&limit=20&search=${encodeURIComponent(createBody.email)}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listBody = bodyOf<UserListResponse>(list);
    expect(listBody.items.some((item) => item.uuid === uuid)).toBe(true);

    await httpRequest()
      .patch(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ username: `updated-${randomUUID().slice(0, 8)}` })
      .expect(200);

    await httpRequest()
      .delete(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    const persisted = await prisma.authenticationUser.findUniqueOrThrow({
      where: { uuid },
    });
    expect(persisted.deletedAt).not.toBeNull();
    expect(persisted.isActive).toBe(false);
    expect(
      await prisma.auditLog.count({
        where: { action: 'USER_DELETED', userId: persisted.id },
      }),
    ).toBe(1);
  });

  it('enforces profile ownership and supports profile create/read/update', async () => {
    const actorToken = await tokenFor(actorUuid);
    const ownerToken = await tokenFor(targetUuid);
    await httpRequest()
      .post(`/api/v1/users/${targetUuid}/profile`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Target', lastName: 'Owner', locale: 'id-ID' })
      .expect(201);

    const own = await httpRequest()
      .get(`/api/v1/users/${targetUuid}/profile`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const ownBody = bodyOf<ProfileResponse>(own);
    expect(ownBody.firstName).toBe('Target');
    expect(ownBody.locale).toBe('id-ID');

    await httpRequest()
      .get(`/api/v1/users/${targetUuid}/profile`)
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(403);

    await httpRequest()
      .patch(`/api/v1/users/${targetUuid}/profile`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ locale: 'en-US' })
      .expect(200);
    const target = await prisma.authenticationUser.findUniqueOrThrow({
      where: { uuid: targetUuid },
    });
    const profile = await prisma.authenticationUserProfile.findUnique({
      where: { userId: target.id },
    });
    expect(profile?.locale).toBe('en-US');
  });

  it('changes the current password, rejects the old credential, and accepts the new credential', async () => {
    const token = await tokenFor(actorUuid);
    await httpRequest()
      .post('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'Changed-Password-456!',
        confirmation: 'Changed-Password-456!',
      })
      .expect(201);

    const actor = await prisma.authenticationUser.findUniqueOrThrow({
      where: { uuid: actorUuid },
    });
    await httpRequest()
      .post('/api/v1/auth/login')
      .send({ identifier: actor.email, password: PASSWORD })
      .expect(401);
    const login = await httpRequest()
      .post('/api/v1/auth/login')
      .send({ identifier: actor.email, password: 'Changed-Password-456!' })
      .expect(201);
    expect(bodyOf<LoginResponse>(login).accessToken).toEqual(
      expect.any(String),
    );
    expect(
      await prisma.authenticationUserCredential.count({
        where: { userId: actor.id },
      }),
    ).toBe(1);
    expect(
      await prisma.authenticationUserSession.count({
        where: { userId: actor.id },
      }),
    ).toBe(1);
  });
});
