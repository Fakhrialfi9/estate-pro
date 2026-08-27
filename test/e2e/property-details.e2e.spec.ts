import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';

type AuthContext = { uuid: string; token: string };
type Body = { data?: { uuid?: string } };

const PERMISSIONS = [
  'property-specifications.read',
  'property-specifications.update',
  'property-locations.read',
  'property-locations.update',
  'property-buildings.read',
  'property-buildings.update',
  'property-rooms.create',
  'property-rooms.read',
  'property-rooms.update',
  'property-rooms.delete',
  'property-rooms.reorder',
  'property-facilities.read',
  'property-facilities.attach',
  'property-facilities.update',
  'property-facilities.detach',
  'property-facilities.bulk-attach',
] as const;
const http = (app: NestExpressApplication) => request(app.getHttpServer());

let app: NestExpressApplication;
let prisma: PrismaService;
let tokens: JwtTokenService;
let actor: AuthContext;
let denied: AuthContext;
let typeId: bigint;
let categoryId: bigint;
let propertyUuid: string;
let propertyTwoUuid: string;
let facilityUuid: string;

async function makeActor(grant: boolean): Promise<AuthContext> {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email: `${randomUUID()}@detail-e2e.test`,
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
        name: `Detail E2E ${randomUUID()}`,
        code: `detail-e2e-${randomUUID()}`,
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

async function createProperty() {
  return prisma.property.create({
    data: {
      uuid: randomUUID(),
      businessCode: `B-${randomUUID().replaceAll('-', '').slice(0, 22)}`,
      referenceNumber: `R-${randomUUID()}`,
      propertyTypeId: typeId,
      propertyCategoryId: categoryId,
      title: 'Detail E2E Property',
      slug: `detail-e2e-${randomUUID()}`,
    },
  });
}

describe('Property detail child APIs', () => {
  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = ref.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(JwtTokenService);
  });

  beforeEach(async () => {
    const createdType = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'House',
        slug: `e2e-house-${randomUUID()}`,
      },
    });
    typeId = createdType.id;
    const createdCategory = await prisma.propertyCategory.create({
      data: {
        uuid: randomUUID(),
        propertyTypeId: typeId,
        code: `E2E-${randomUUID().slice(0, 8)}`,
        name: 'Residential',
        slug: `e2e-res-${randomUUID()}`,
      },
    });
    categoryId = createdCategory.id;
    const property = await createProperty();
    propertyUuid = property.uuid;
    const second = await createProperty();
    propertyTwoUuid = second.uuid;
    const facility = await prisma.facility.create({
      data: {
        uuid: randomUUID(),
        code: `E2E-F-${randomUUID().slice(0, 8)}`,
        name: 'Gym',
        slug: `gym-${randomUUID()}`,
        category: 'RECREATION',
        isActive: true,
      },
    });
    facilityUuid = facility.uuid;
    actor = await makeActor(true);
    denied = await makeActor(false);
  });

  afterAll(async () => {
    await prisma.propertyFacility.deleteMany();
    await prisma.propertyRoom.deleteMany();
    await prisma.propertyBuilding.deleteMany();
    await prisma.propertyLocation.deleteMany();
    await prisma.propertySpecification.deleteMany();
    await prisma.property.deleteMany();
    await prisma.facility.deleteMany({
      where: { code: { startsWith: 'E2E-F-' } },
    });
    await prisma.authorizationUserRole.deleteMany({
      where: { user: { email: { contains: '@detail-e2e.test' } } },
    });
    await prisma.authorizationRolePermission.deleteMany({
      where: { role: { code: { startsWith: 'detail-e2e-' } } },
    });
    await prisma.authorizationRole.deleteMany({
      where: { code: { startsWith: 'detail-e2e-' } },
    });
    await prisma.authenticationUserSession.deleteMany({
      where: { user: { email: { contains: '@detail-e2e.test' } } },
    });
    await prisma.authenticationUser.deleteMany({
      where: { email: { contains: '@detail-e2e.test' } },
    });
    await app.close();
  });

  it('runs the full child-resource flow and blocks anonymous/unauthorized access', async () => {
    await http(app)
      .get(`/api/v1/property/properties/${propertyUuid}/specifications`)
      .expect(401);
    await http(app)
      .get(`/api/v1/property/properties/${propertyUuid}/specifications`)
      .set('Authorization', `Bearer ${denied.token}`)
      .expect(403);

    const specification = await http(app)
      .patch(`/api/v1/property/properties/${propertyUuid}/specifications`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        landArea: '100.50',
        buildingArea: '80.25',
        floorArea: '80.25',
        bedrooms: 3,
        bathrooms: '2.50',
        floors: 2,
        parkingType: 'GARAGE',
        parkingSpaces: 2,
        yearBuilt: 2020,
        yearRenovated: 2024,
        orientation: 'SOUTH',
        condition: 'GOOD',
        furnishedStatus: 'FULLY_FURNISHED',
      })
      .expect(200);
    expect((specification.body as Body).data?.uuid).toBeTruthy();

    await http(app)
      .patch(`/api/v1/property/properties/${propertyUuid}/location`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        latitude: '-6.2000000',
        longitude: '106.8166667',
        mapProvider: 'GOOGLE_MAPS',
        coordinateAccuracy: 'ROOFTOP',
        mapUrl: 'https://maps.google.com/?q=-6.2,106.8166',
      })
      .expect(200);
    await http(app)
      .patch(`/api/v1/property/properties/${propertyUuid}/building`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        hasPool: true,
        poolLengthM: '10.00',
        poolWidthM: '4.00',
        poolDepthM: '1.50',
        smartHome: true,
      })
      .expect(200);
    const room = await http(app)
      .post(`/api/v1/property/properties/${propertyUuid}/rooms`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({
        roomType: 'MASTER_BEDROOM',
        name: 'Master Suite',
        floor: 1,
        area: '25.50',
        hasBathroom: true,
      })
      .expect(201);
    const roomUuid = (room.body as Body).data?.uuid;
    expect(roomUuid).toBeTruthy();
    await http(app)
      .patch(`/api/v1/property/properties/${propertyUuid}/rooms/${roomUuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'Primary Suite', floor: 1 })
      .expect(200);
    await http(app)
      .post(`/api/v1/property/properties/${propertyUuid}/facilities`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ facilityUuid, quantity: 2, available: true, notes: 'E2E' })
      .expect(201);
    await http(app)
      .patch(
        `/api/v1/property/properties/${propertyUuid}/facilities/${facilityUuid}`,
      )
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ quantity: 3, available: false })
      .expect(200);
    await http(app)
      .delete(
        `/api/v1/property/properties/${propertyUuid}/facilities/${facilityUuid}`,
      )
      .set('Authorization', `Bearer ${actor.token}`)
      .expect(204);
  });

  it('rejects invalid coordinate, inactive facilities, duplicates, and cross-property room access', async () => {
    await http(app)
      .patch(`/api/v1/property/properties/${propertyUuid}/location`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ latitude: '95', longitude: '106' })
      .expect(400);
    const inactive = await prisma.facility.create({
      data: {
        uuid: randomUUID(),
        code: `E2E-F-${randomUUID().slice(0, 8)}`,
        name: 'Inactive',
        slug: `inactive-${randomUUID()}`,
        category: 'UTILITY',
        isActive: false,
      },
    });
    await http(app)
      .post(`/api/v1/property/properties/${propertyUuid}/facilities`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ facilityUuid: inactive.uuid })
      .expect(400);
    await http(app)
      .post(`/api/v1/property/properties/${propertyUuid}/facilities`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ facilityUuid })
      .expect(201);
    await http(app)
      .post(`/api/v1/property/properties/${propertyUuid}/facilities`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ facilityUuid })
      .expect(409);
    const room = await http(app)
      .post(`/api/v1/property/properties/${propertyUuid}/rooms`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ roomType: 'BEDROOM', name: 'Private', floor: 1, area: '12' })
      .expect(201);
    const roomUuid = (room.body as Body).data?.uuid;
    await http(app)
      .patch(`/api/v1/property/properties/${propertyTwoUuid}/rooms/${roomUuid}`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ name: 'IDOR' })
      .expect(404);
  });
});
