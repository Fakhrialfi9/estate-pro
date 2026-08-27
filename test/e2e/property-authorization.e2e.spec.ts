import { afterAll, beforeAll, describe, it } from 'vitest';
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

type Actor = { actorUuid: string; permissions: readonly string[] };

const accessTokenFor = (jwt: JwtService, actor: Actor): string =>
  jwt.sign({ sub: actor.actorUuid, permissions: actor.permissions });

const propertyFixture = () => ({
  uuid: randomUUID(),
  businessCode: `PROP-${randomUUID().slice(0, 8)}`,
  referenceNumber: `REF-${randomUUID().slice(0, 8)}`,
  title: 'Authorization test property',
  slug: `authorization-test-${randomUUID().slice(0, 8)}`,
});

describe('Property authorization E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects create without the required permission', async () => {
    const actor = { actorUuid: randomUUID(), permissions: ['properties.read'] };
    const token = accessTokenFor(jwt, actor);
    await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(propertyFixture())
      .expect(403);
  });

  it('permits create when the required permission is present', async () => {
    const actor = { actorUuid: randomUUID(), permissions: PERMISSIONS };
    const token = accessTokenFor(jwt, actor);
    await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(propertyFixture())
      .expect(201);
  });

  it('protects direct property reads from missing permission', async () => {
    const actor = { actorUuid: randomUUID(), permissions: [] };
    const token = accessTokenFor(jwt, actor);
    const property = await prisma.property.findFirst({
      where: { deletedAt: null },
      select: { uuid: true },
    });
    if (!property) return;
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${property.uuid}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
