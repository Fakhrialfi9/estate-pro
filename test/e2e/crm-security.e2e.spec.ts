import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';

describe('CRM security boundary', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app as NestExpressApplication);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });
  it('denies unauthenticated access to private CRM endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/crm/contacts').expect(401);
  });
  it('does not let malformed UUIDs reach the CRM application layer', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/crm/contacts/not-a-uuid',
    );
    expect([400, 401]).toContain(response.status);
  });
  it('keeps public inquiry intake separate from private CRM management', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/crm/public/inquiries')
      .send({ intent: 'CONTACT_MESSAGE', message: 'hello', website: 'spam' });
    expect(response.status).not.toBe(401);
  });
});
