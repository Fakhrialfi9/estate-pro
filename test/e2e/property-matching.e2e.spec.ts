import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';
import { SessionService } from '../../src/modules/auth/application/services/session.service.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { httpRequest } from './helpers/http.js';

async function createActor(prisma: PrismaService, tokens: JwtTokenService) {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email: `${randomUUID()}@matching.e2e`,
      status: 'active',
      isActive: true,
    },
  });
  const rawSession = randomUUID();
  await prisma.authenticationUserSession.create({
    data: {
      userId: user.id,
      sessionId: SessionService.digestSecret(rawSession),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return {
    uuid: user.uuid,
    id: user.id,
    token: await tokens.issueAccessToken(user.uuid, rawSession),
  };
}

describe('Property Matching E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: JwtTokenService;
  let owner: Awaited<ReturnType<typeof createActor>>;
  let other: Awaited<ReturnType<typeof createActor>>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(
      app as unknown as Parameters<typeof configureApplication>[0],
    );
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(JwtTokenService);
    owner = await createActor(prisma, tokens);
    other = await createActor(prisma, tokens);
  });

  afterAll(async () => {
    await prisma.matchFeedback.deleteMany({
      where: { subjectUuid: owner.uuid },
    });
    await prisma.recommendationHistory.deleteMany({
      where: { subjectUuid: owner.uuid },
    });
    await prisma.recommendation.deleteMany({
      where: { subjectUuid: owner.uuid },
    });
    await prisma.matchScore.deleteMany({ where: { subjectUuid: owner.uuid } });
    await prisma.propertyPreference.deleteMany({
      where: { subjectUuid: owner.uuid },
    });
    for (const actor of [owner, other]) {
      await prisma.authenticationUserSession.deleteMany({
        where: { userId: actor.id },
      });
      await prisma.authenticationUser.delete({ where: { id: actor.id } });
    }
    await app.close();
  });

  it('enforces subject ownership and optimistic preference versioning', async () => {
    const payload = {
      subjectType: 'USER',
      subjectUuid: owner.uuid,
      transactionTypes: ['SALE'],
      propertyTypeUuids: [],
      propertyCategoryUuids: [],
      hardCriteria: ['transactionType'],
      budget: {
        min: '500000000',
        max: '1000000000',
        currency: 'IDR',
        frequency: 'TOTAL',
      },
    };
    const created = await httpRequest(app)
      .post('/api/v1/property-matching/preferences')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(payload)
      .expect(201);
    const createdBody = created.body as { version: number };
    expect(createdBody.version).toBe(1);

    await httpRequest(app)
      .patch(`/api/v1/property-matching/preferences/USER/${owner.uuid}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        ...payload,
        version: 1,
        budget: { ...payload.budget, max: '1200000000' },
      })
      .expect(200);

    await httpRequest(app)
      .patch(`/api/v1/property-matching/preferences/USER/${owner.uuid}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...payload, version: 1 })
      .expect(409);

    await httpRequest(app)
      .get(`/api/v1/property-matching/preferences/USER/${owner.uuid}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);
  });

  it('generates a traceable recommendation snapshot and history', async () => {
    const generated = await httpRequest(app)
      .post('/api/v1/property-matching/recommendations/generate')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        subjectType: 'USER',
        subjectUuid: owner.uuid,
        minScore: 35,
        limit: 20,
      })
      .expect(200);
    const generatedBody = generated.body as { algorithmVersion: number };
    expect(generatedBody.algorithmVersion).toBe(1);

    const latest = await httpRequest(app)
      .get(`/api/v1/property-matching/recommendations/USER/${owner.uuid}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const latestBody = latest.body as { preferenceVersion: unknown };
    expect(latestBody.preferenceVersion).toBeDefined();

    const history = await httpRequest(app)
      .get(
        `/api/v1/property-matching/recommendations/USER/${owner.uuid}/history`,
      )
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const historyBody = history.body as { meta: { total: number } };
    expect(historyBody.meta.total).toBeGreaterThan(0);
  });

  it('protects the matching endpoints behind session authentication', async () => {
    await httpRequest(app)
      .post('/api/v1/property-matching/recommendations/refresh')
      .send({ subjectType: 'USER', subjectUuid: owner.uuid })
      .expect(401);
    await httpRequest(app)
      .get('/api/v1/property-matching/saved-properties')
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { data: unknown };
        expect(body.data).toBeInstanceOf(Array);
      });
  });
});
