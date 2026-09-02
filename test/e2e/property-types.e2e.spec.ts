import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { SessionService } from '../../src/modules/auth/application/services/session.service.js';
import { httpRequest } from './helpers/http.js';

const permissions = [
  'property-types.create',
  'property-types.read',
  'property-types.update',
  'property-types.delete',
] as const;

async function makeActor(
  prisma: PrismaService,
  tokens: JwtTokenService,
  grant: boolean,
) {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email: `${randomUUID()}@example.com`,
      status: 'active',
      isActive: true,
    },
  });
  const sessionId = randomUUID();
  await prisma.authenticationUserSession.create({
    data: {
      userId: user.id,
      sessionId: SessionService.digestSecret(sessionId),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  if (grant) {
    const rows = await Promise.all(
      permissions.map((code) =>
        prisma.authorizationPermission.upsert({
          where: { code },
          update: {},
          create: {
            uuid: randomUUID(),
            name: code,
            code,
            module: 'property',
            domain: 'property-types',
            action: code.split('.')[1] ?? 'manage',
          },
        }),
      ),
    );
    const role = await prisma.authorizationRole.create({
      data: {
        uuid: randomUUID(),
        name: 'E2E Property Type Manager',
        code: `e2e-${randomUUID()}`,
        isActive: true,
      },
    });
    await prisma.authorizationRolePermission.createMany({
      data: rows.map((row) => ({ roleId: role.id, permissionId: row.id })),
    });
    await prisma.authorizationUserRole.create({
      data: { userId: user.id, roleId: role.id, assignedBy: user.id },
    });
  }
  return { uuid: user.uuid, sessionId };
}

type PropertyTypeResponse = {
  uuid: string;
  code: string;
  slug: string;
  name: string;
};

type PropertyTypeListResponse = {
  meta: { total: number };
};

describe('Property Types HTTP API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: JwtTokenService;
  let admin: { uuid: string; sessionId: string };
  let denied: { uuid: string; sessionId: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app as Parameters<typeof configureApplication>[0]);
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(JwtTokenService);
  });

  beforeEach(async () => {
    await prisma.auditLogChange.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.authorizationUserRole.deleteMany();
    await prisma.authorizationRolePermission.deleteMany();
    await prisma.authorizationRole.deleteMany();
    await prisma.authorizationPermission.deleteMany();
    await prisma.authenticationRefreshToken.deleteMany();
    await prisma.authenticationRefreshTokenFamily.deleteMany();
    await prisma.authenticationUserSession.deleteMany();
    await prisma.authenticationUser.deleteMany();
    await prisma.property.deleteMany();
    await prisma.propertySubcategory.deleteMany();
    await prisma.propertyCategory.deleteMany();
    await prisma.propertyType.deleteMany();
    admin = await makeActor(prisma, tokens, true);
    denied = await makeActor(prisma, tokens, false);
  });

  afterAll(() => app.close());

  const auth = async (actor: { uuid: string; sessionId: string }) =>
    `Bearer ${await tokens.issueAccessToken(actor.uuid, actor.sessionId)}`;

  const payload = {
    code: 'HOUSE',
    name: 'House',
    slug: 'house',
    description: 'Residential',
    icon: 'house',
    isActive: true,
    sortOrder: 10,
  };

  it('rejects anonymous and forbidden access', async () => {
    await httpRequest(app).get('/api/v1/property-types').expect(401);
    await httpRequest(app)
      .get('/api/v1/property-types')
      .set('Authorization', await auth(denied))
      .expect(403);
  });

  it('rejects validation errors and duplicate identifiers', async () => {
    const bad = await httpRequest(app)
      .post('/api/v1/property-types')
      .set('Authorization', await auth(admin))
      .send({ ...payload, unknown: true });
    expect(bad.status).toBe(400);
    await httpRequest(app)
      .post('/api/v1/property-types')
      .set('Authorization', await auth(admin))
      .send(payload)
      .expect(201);
    await httpRequest(app)
      .post('/api/v1/property-types')
      .set('Authorization', await auth(admin))
      .send(payload)
      .expect(409);
  });

  it('supports create, get, list, update and soft-delete', async () => {
    const created = await httpRequest(app)
      .post('/api/v1/property-types')
      .set('Authorization', await auth(admin))
      .send(payload)
      .expect(201);
    const createdBody = created.body as PropertyTypeResponse;
    const uuid = createdBody.uuid;
    expect(createdBody).toMatchObject({ code: 'HOUSE', slug: 'house' });

    await httpRequest(app)
      .get(`/api/v1/property-types/${uuid}`)
      .set('Authorization', await auth(admin))
      .expect(200);

    const list = await httpRequest(app)
      .get('/api/v1/property-types')
      .query({ sortBy: 'sortOrder', sortDirection: 'asc' })
      .set('Authorization', await auth(admin))
      .expect(200);
    const listBody = list.body as PropertyTypeListResponse;
    expect(listBody.meta.total).toBe(1);

    const updated = await httpRequest(app)
      .patch(`/api/v1/property-types/${uuid}`)
      .set('Authorization', await auth(admin))
      .send({ name: 'Town House', sortOrder: 20 })
      .expect(200);
    const updatedBody = updated.body as PropertyTypeResponse;
    expect(updatedBody.name).toBe('Town House');

    await httpRequest(app)
      .delete(`/api/v1/property-types/${uuid}`)
      .set('Authorization', await auth(admin))
      .expect(204);
    await httpRequest(app)
      .get(`/api/v1/property-types/${uuid}`)
      .set('Authorization', await auth(admin))
      .expect(404);

    const afterDelete = await httpRequest(app)
      .get('/api/v1/property-types')
      .set('Authorization', await auth(admin))
      .expect(200);
    const afterDeleteBody = afterDelete.body as PropertyTypeListResponse;
    expect(afterDeleteBody.meta.total).toBe(0);
  });

  it('rejects invalid boolean filter and update by forbidden actor', async () => {
    await httpRequest(app)
      .get('/api/v1/property-types')
      .query({ filterField: 'isActive', filterValue: 'maybe' })
      .set('Authorization', await auth(admin))
      .expect(400);
    await httpRequest(app)
      .patch(`/api/v1/property-types/${randomUUID()}`)
      .set('Authorization', await auth(denied))
      .send({ name: 'Blocked' })
      .expect(403);
  });
});
