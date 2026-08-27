import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

const PERMISSIONS = [
  'properties.create',
  'properties.read',
  'properties.update',
  'properties.delete',
] as const;

async function createActor(
  prisma: PrismaService,
  jwt: JwtService,
): Promise<{ uuid: string; token: string }> {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email: `${randomUUID()}@authorization.e2e`,
      status: 'active',
      isActive: true,
    },
  });
  const sessionId = randomUUID();
  await prisma.authenticationUserSession.create({
    data: {
      userId: user.id,
      sessionId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
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
          domain: 'properties',
          action: code.split('.')[1] ?? 'manage',
        },
      }),
    ),
  );
  const role = await prisma.authorizationRole.create({
    data: {
      uuid: randomUUID(),
      name: `Property Access ${randomUUID()}`,
      code: `property-access-${randomUUID()}`,
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
  return { uuid: user.uuid, token: jwt.sign({ sub: user.uuid, sid: sessionId }) };
}

describe('Property object-level authorization', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let owner: { uuid: string; token: string };
  let other: { uuid: string; token: string };
  let typeId: bigint;
  let categoryId: bigint;
  let propertyUuid: string;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    configureApplication(app as unknown as Parameters<typeof configureApplication>[0]);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    owner = await createActor(prisma, jwt);
    other = await createActor(prisma, jwt);
    const type = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `HOUSE-${randomUUID().slice(0, 8)}`,
        name: 'House',
        slug: `house-${randomUUID()}`,
      },
    });
    typeId = type.id;
    const category = await prisma.propertyCategory.create({
      data: {
        uuid: randomUUID(),
        propertyTypeId: type.id,
        code: `RES-${randomUUID().slice(0, 8)}`,
        name: 'Residential',
        slug: `res-${randomUUID()}`,
      },
    });
    categoryId = category.id;
    const response = await request(app.getHttpServer())
      .post('/api/v1/property/properties')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        typeUuid: type.uuid,
        categoryUuid: category.uuid,
        title: 'Owner Property',
        slug: `owner-property-${randomUUID()}`,
      })
      .expect(201);
    propertyUuid = response.body.data.uuid as string;
  });

  afterAll(async () => {
    await prisma.propertyAgentAssignment.deleteMany({
      where: { propertyId: (await prisma.property.findFirstOrThrow({ where: { uuid: propertyUuid } })).id },
    });
    await prisma.property.deleteMany({ where: { uuid: propertyUuid } });
    await prisma.propertyCategory.deleteMany({ where: { id: categoryId } });
    await prisma.propertyType.deleteMany({ where: { id: typeId } });
    await prisma.authorizationUserRole.deleteMany({
      where: { userId: { in: [owner.uuid, other.uuid] } },
    });
    await prisma.authenticationUserSession.deleteMany({
      where: { user: { uuid: { in: [owner.uuid, other.uuid] } } },
    });
    await prisma.authenticationUser.deleteMany({
      where: { uuid: { in: [owner.uuid, other.uuid] } },
    });
    await app.close();
  });

  it('allows the owner and denies a different authenticated user', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/property/properties/${propertyUuid}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/property/properties/${propertyUuid}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);
  });

  it('blocks IDOR mutations even when the attacker has the CRUD permission', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/property/properties/${propertyUuid}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ title: 'Unauthorized update', version: 1 })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/property/properties/${propertyUuid}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);
  });

  it('allows an actively assigned agent to read the property', async () => {
    const property = await prisma.property.findFirstOrThrow({
      where: { uuid: propertyUuid },
      select: { id: true },
    });
    const agent = await prisma.authenticationUser.findFirstOrThrow({
      where: { uuid: other.uuid },
      select: { uuid: true },
    });
    await prisma.propertyAgentAssignment.create({
      data: {
        uuid: randomUUID(),
        propertyId: property.id,
        agentUserUuid: agent.uuid,
        agentDisplayName: 'Authorized Agent',
        isPrimary: true,
        createdBy: owner.uuid,
        updatedBy: owner.uuid,
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/property/properties/${propertyUuid}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
  });

  it('denies anonymous access before object resolution', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/property/properties/${propertyUuid}`)
      .expect(401);
  });
});
