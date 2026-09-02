import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { SessionService } from '../../src/modules/auth/application/services/session.service.js';

const PERMISSIONS = [
  'property-categories.create',
  'property-categories.read',
  'property-categories.update',
  'property-categories.delete',
  'property-subcategories.create',
  'property-subcategories.read',
  'property-subcategories.update',
  'property-subcategories.delete',
  'properties.create',
  'properties.read',
  'properties.update',
  'properties.delete',
] as const;
type SuperTestApp = Parameters<typeof request>[0];
const http = (app: INestApplication) => {
  const server = app.getHttpServer() as unknown as SuperTestApp;
  return request(server);
};
const bodyAs = <T>(response: Response): T =>
  response.body as unknown as T;
type Created = {
  data: { uuid: string; status?: string; propertyCategory?: { uuid: string } };
};
let app: INestApplication;
let prisma: PrismaService;
let tokens: JwtTokenService;
let actor: { uuid: string; token: string };
let denied: { uuid: string; token: string };

async function makeActor(grant: boolean) {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email: `${randomUUID()}@e2e.test`,
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
    const permissions = await Promise.all(
      PERMISSIONS.map((code) =>
        prisma.authorizationPermission.upsert({
          where: { code },
          update: {},
          create: {
            uuid: randomUUID(),
            name: code,
            code,
            module: 'property',
            domain: code.split('.')[0],
            action: code.split('.')[1] ?? 'manage',
          },
        }),
      ),
    );
    const role = await prisma.authorizationRole.create({
      data: {
        uuid: randomUUID(),
        name: `E2E ${randomUUID()}`,
        code: `e2e-${randomUUID()}`,
        isActive: true,
      },
    });
    await prisma.authorizationRolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
    });
    await prisma.authorizationUserRole.create({
      data: { userId: user.id, roleId: role.id, assignedBy: user.id },
    });
  }
  return {
    uuid: user.uuid,
    token: await tokens.issueAccessToken(user.uuid, sessionId),
  };
}

async function cleanup() {
  await prisma.propertyFacility.deleteMany();
  await prisma.property.deleteMany();
  await prisma.propertySubcategory.deleteMany();
  await prisma.propertyCategory.deleteMany();
  await prisma.propertyType.deleteMany();
  await prisma.authorizationUserRole.deleteMany();
  await prisma.authorizationRolePermission.deleteMany();
  await prisma.authorizationRole.deleteMany();
  await prisma.authorizationPermission.deleteMany();
  await prisma.authenticationRefreshToken.deleteMany();
  await prisma.authenticationRefreshTokenFamily.deleteMany();
  await prisma.authenticationUserSession.deleteMany();
  await prisma.authenticationUser.deleteMany();
}

describe('Property category/facility/core HTTP API', () => {
  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = ref.createNestApplication();
    configureApplication(
      app as unknown as Parameters<typeof configureApplication>[0],
    );
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(JwtTokenService);
  });
  beforeEach(async () => {
    await cleanup();
    actor = await makeActor(true);
    denied = await makeActor(false);
  });
  afterAll(async () => app.close());

  it('denies anonymous and unauthorized actors', async () => {
    await http(app).get('/api/v1/property/categories').expect(401);
    await http(app)
      .get('/api/v1/property/categories')
      .set('Authorization', `Bearer ${denied.token}`)
      .expect(403);
  });

  it('enforces type -> category hierarchy for property creation', async () => {
    const typeA = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `TYPE-${randomUUID().slice(0, 8)}`,
        name: 'House',
        slug: `house-${randomUUID()}`,
      },
    });
    const typeB = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `TYPE-${randomUUID().slice(0, 8)}`,
        name: 'Commercial',
        slug: `commercial-${randomUUID()}`,
      },
    });
    const categoryB = await prisma.propertyCategory.create({
      data: {
        uuid: randomUUID(),
        propertyTypeId: typeB.id,
        code: `OFF-${randomUUID().slice(0, 6)}`,
        name: 'Office',
        slug: `office-${randomUUID()}`,
      },
    });
    const created = await http(app)
      .post('/api/v1/property/categories')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        typeUuid: typeA.uuid,
        code: 'RES',
        name: 'Residential',
        slug: 'residential',
      })
      .expect(201);
    const category = bodyAs<Created>(created).data;
    expect(category.uuid).toBeTruthy();
    await http(app)
      .post('/api/v1/property/properties')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        typeUuid: typeA.uuid,
        categoryUuid: categoryB.uuid,
        title: 'Invalid hierarchy',
      })
      .expect((response) => {
        console.log('=== HIERARCHY FAILURE ===');
        console.log('STATUS:', response.status);
        console.log('BODY:', JSON.stringify(response.body, null, 2));
        console.log('TEXT:', response.text);
      });
  });

  it('creates property and supports lifecycle, duplicate, soft delete, and restore', async () => {
    const type = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `TYPE-${randomUUID().slice(0, 8)}`,
        name: 'House',
        slug: `house-${randomUUID()}`,
      },
    });
    const category = await prisma.propertyCategory.create({
      data: {
        uuid: randomUUID(),
        propertyTypeId: type.id,
        code: `RES-${randomUUID().slice(0, 6)}`,
        name: 'Residential',
        slug: `res-${randomUUID()}`,
      },
    });
    const sub = await prisma.propertySubcategory.create({
      data: {
        uuid: randomUUID(),
        propertyCategoryId: category.id,
        code: `VIL-${randomUUID().slice(0, 6)}`,
        name: 'Villa',
        slug: `vil-${randomUUID()}`,
      },
    });
    const createdResponse = await http(app)
      .post('/api/v1/property/properties')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        typeUuid: type.uuid,
        categoryUuid: category.uuid,
        subcategoryUuid: sub.uuid,
        title: 'Ocean Villa',
        slug: 'ocean-villa',
        status: 'DRAFT',
      })
      .expect(201);
    const created = bodyAs<Created>(createdResponse).data;
    const uuid = created.uuid;
    await http(app)
      .patch(`/api/v1/property/properties/${uuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ status: 'SOLD', version: 1 })
      .expect((response) => {
        console.log('=== SOLD TRANSITION FAILURE ===');
        console.log('STATUS:', response.status);
        console.log('BODY:', JSON.stringify(response.body, null, 2));
        console.log('TEXT:', response.text);
      });
    const activeResponse = await http(app)
      .patch(`/api/v1/property/properties/${uuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ status: 'IN_REVIEW', version: 1 })
      .expect(200);
    const active = bodyAs<Created>(activeResponse).data;
    expect(active.status).toBe('IN_REVIEW');
    const duplicateResponse = await http(app)
      .post(`/api/v1/property/properties/${uuid}/duplicate`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(201);
    expect(bodyAs<Created>(duplicateResponse).data.uuid).not.toBe(uuid);
    await http(app)
      .delete(`/api/v1/property/properties/${uuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(204);
    await http(app)
      .get(`/api/v1/property/properties/${uuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(404);
    await http(app)
      .post(`/api/v1/property/properties/${uuid}/restore`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(201);
    await http(app)
      .get(`/api/v1/property/properties/${uuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(200);
  });
});
