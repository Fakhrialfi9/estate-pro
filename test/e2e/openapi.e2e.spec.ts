import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { configureApplication, configureSwagger } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AutomationScheduler } from '../../src/modules/automation/infrastructure/scheduler/automation.scheduler.js';
import { validateOpenApiDocument } from '../../scripts/validate-openapi.mjs';

describe('OpenAPI contract (e2e)', () => {
  let app: NestExpressApplication | undefined;
  let httpApplication: Application | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: () => Promise.resolve([{ 1: 1 }]),
        $connect: () => Promise.resolve(),
        $disconnect: () => Promise.resolve(),
      })
      .overrideProvider(AutomationScheduler)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });

    configureApplication(app);
    configureSwagger(app);
    await app.init();
    httpApplication = app.getHttpAdapter().getInstance() as Application;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('serves the Swagger UI and machine-readable documents', async () => {
    expect((await request(httpApplication!).get('/docs')).status).toBe(200);
    expect((await request(httpApplication!).get('/docs-json')).status).toBe(
      200,
    );
    expect((await request(httpApplication!).get('/docs-yaml')).status).toBe(
      200,
    );
  });

  it('validates the runtime-generated OpenAPI contract', async () => {
    const response = await request(httpApplication!).get('/docs-json');
    expect(response.status).toBe(200);

    const result = validateOpenApiDocument(response.body);
    expect(result.operationCount).toBeGreaterThan(0);
    expect(result.schemaCount).toBeGreaterThan(0);
  });
});
