import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { httpRequest } from './helpers/http.js';

describe('Property capabilities E2E security boundary', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    configureApplication(app as Parameters<typeof configureApplication>[0]);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for amenity mutations and sensitive document/history endpoints', async () => {
    const propertyUuid = '11111111-1111-4111-8111-111111111111';
    const amenityUuid = '22222222-2222-4222-8222-222222222222';
    const documentUuid = '33333333-3333-4333-8333-333333333333';

    await httpRequest(app).get('/api/v1/property/amenities').expect(401);
    await httpRequest(app).post('/api/v1/property/amenities').send({ code: 'POOL', name: 'Pool', category: 'RECREATION' }).expect(401);
    await httpRequest(app).get(`/api/v1/property/properties/${propertyUuid}/amenities`).expect(401);
    await httpRequest(app).put(`/api/v1/property/properties/${propertyUuid}/amenities/${amenityUuid}`).send({ available: true }).expect(401);
    await httpRequest(app).get(`/api/v1/property/properties/${propertyUuid}/documents`).expect(401);
    await httpRequest(app).get(`/api/v1/property/properties/${propertyUuid}/documents/${documentUuid}`).expect(401);
    await httpRequest(app).get(`/api/v1/property/properties/${propertyUuid}/history`).expect(401);
  });

  it('rejects malformed nested property identifiers before reaching the business layer', async () => {
    await httpRequest(app).get('/api/v1/property/properties/not-a-uuid/documents').expect(401);
    await httpRequest(app).get('/api/v1/property/properties/not-a-uuid/history').expect(401);
  });

  it('keeps the public structured-data endpoint separate from authenticated property capability APIs', async () => {
    const response = await httpRequest(app)
      .get('/api/v1/seo/public/property/not-a-real-property/structured-data')
      .expect(404);
    expect(response.body.message).toBe('Public SEO resource not found');
  });
});
