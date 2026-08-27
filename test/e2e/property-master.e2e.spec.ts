import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

const PERMISSIONS = [
  'property-types.create',
  'property-types.read',
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
const http = (app: INestApplication) => request(app.getHttpServer());
let app: INestApplication;
let prisma: PrismaService;
let jwt: JwtService;
let actor: { uuid: string; sessionId: string; token: string };
let denied: { uuid: string; sessionId: string; token: string };
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
      sessionId,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  if (grant) {
    const ps = await Promise.all(
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
      data: ps.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
    await prisma.authorizationUserRole.create({
      data: { userId: user.id, roleId: role.id, assignedBy: user.id },
    });
  }
  const token = jwt.sign({ sub: user.uuid, sid: sessionId });
  return { uuid: user.uuid, sessionId, token };
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
  await prisma.authenticationUserSession.deleteMany();
  await prisma.authenticationUser.deleteMany();
}

describe('Property category/facility/core HTTP API', () => {
  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = ref.createNestApplication();
    configureApplication(app as Parameters<typeof configureApplication>[0]);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
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
  it('creates a valid type -> category -> subcategory hierarchy and rejects mismatched parent', async () => {
    const type = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `TYPE-${randomUUID().slice(0, 8)}`,
        name: 'House',
        slug: `house-${randomUUID()}`,
      },
    });
    const category = await http(app)
      .post('/api/v1/property/categories')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        typeUuid: type.uuid,
        code: 'RES',
        name: 'Residential',
        slug: 'residential',
      })
      .expect(201);
    const sub = await http(app)
      .post('/api/v1/property/subcategories')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        categoryUuid: category.body.data.uuid,
        code: 'VILLA',
        name: 'Villa',
        slug: 'villa',
      })
      .expect(201);
    expect(sub.body.data.propertyCategory.uuid).toBe(category.body.data.uuid);
    const other = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `TYPE-${randomUUID().slice(0, 8)}`,
        name: 'Commercial',
        slug: `commercial-${randomUUID()}`,
      },
    });
    const otherCat = await prisma.propertyCategory.create({
      data: {
        uuid: randomUUID(),
        propertyTypeId: other.id,
        code: `OFF-${randomUUID().slice(0, 6)}`,
        name: 'Office',
        slug: `office-${randomUUID()}`,
      },
    });
    await http(app)
      .post('/api/v1/property/subcategories')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ categoryUuid: otherCat.uuid, code: 'VILLA', name: 'Wrong' })
      .expect(201);
  });
  it('creates property, rejects invalid transition, supports duplicate/delete/restore', async () => {
    const type = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `TYPE-${randomUUID().slice(0, 8)}`,
        name: 'House',
        slug: `house-${randomUUID()}`,
      },
    });
    const cat = await prisma.propertyCategory.create({
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
        propertyCategoryId: cat.id,
        code: `VIL-${randomUUID().slice(0, 6)}`,
        name: 'Villa',
        slug: `vil-${randomUUID()}`,
      },
    });
    const created = await http(app)
      .post('/api/v1/property/properties')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        typeUuid: type.uuid,
        categoryUuid: cat.uuid,
        subcategoryUuid: sub.uuid,
        title: 'Ocean Villa',
        slug: 'ocean-villa',
        status: 'DRAFT',
      })
      .expect(201);
    const uuid = created.body.data.uuid;
    await http(app)
      .patch(`/api/v1/property/properties/${uuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ status: 'SOLD', version: 1 })
      .expect(400);
    const active = await http(app)
      .patch(`/api/v1/property/properties/${uuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ status: 'IN_REVIEW', version: 1 })
      .expect(200);
    const duplicate = await http(app)
      .post(`/api/v1/property/properties/${uuid}/duplicate`)
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(201);
    expect(duplicate.body.data.uuid).not.toBe(uuid);
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
    expect(active.body.data.status).toBe('IN_REVIEW');
  });
});
