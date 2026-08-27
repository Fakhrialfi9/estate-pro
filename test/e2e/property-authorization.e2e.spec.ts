import { afterAll, beforeAll, describe, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { SessionService } from '../../src/modules/auth/application/services/session.service.js';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

const PERMISSIONS = [
  'properties.create',
  'properties.read',
  'properties.update',
  'properties.delete',
] as const;

type Actor = {
  uuid: string;
  userId: bigint;
  roleId: bigint;
  token: string;
};

async function createActor(
  prisma: PrismaService,
  tokens: JwtTokenService,
): Promise<Actor> {
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
      sessionId: SessionService.digestSecret(sessionId),
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
  return {
    uuid: user.uuid,
    userId: user.id,
    roleId: role.id,
    token: await tokens.issueAccessToken(user.uuid, sessionId),
  };
}

describe('Property object-level authorization', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: JwtTokenService;
  let owner: Actor;
  let other: Actor;
  let typeId: bigint;
  let categoryId: bigint;
  let propertyUuid: string;

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

    owner = await createActor(prisma, tokens);
    other = await createActor(prisma, tokens);
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
    const property = await prisma.property.findFirst({
      where: { uuid: propertyUuid },
      select: { id: true },
    });
    if (property) {
      await prisma.propertyAgentAssignment.deleteMany({
        where: { propertyId: property.id },
      });
      await prisma.property.delete({ where: { id: property.id } });
    }
    await prisma.propertyCategory.deleteMany({ where: { id: categoryId } });
    await prisma.propertyType.deleteMany({ where: { id: typeId } });
    for (const actor of [owner, other]) {
      await prisma.authorizationUserRole.deleteMany({
        where: { userId: actor.userId, roleId: actor.roleId },
      });
      await prisma.authorizationRolePermission.deleteMany({
        where: { roleId: actor.roleId },
      });
      await prisma.authorizationRole.delete({ where: { id: actor.roleId } });
      await prisma.authenticationUserSession.deleteMany({
        where: { userId: actor.userId },
      });
      await prisma.authenticationUser.delete({ where: { id: actor.userId } });
    }
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
    await prisma.propertyAgentAssignment.create({
      data: {
        uuid: randomUUID(),
        propertyId: property.id,
        agentUserUuid: other.uuid,
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
