import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

describe('application health (e2e)', () => {
  let app: NestExpressApplication | undefined;
  let httpApplication: Application | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
        $connect: vi.fn().mockResolvedValue(undefined),
        $disconnect: vi.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });

    configureApplication(app);
    await app.init();

    const adapterInstance = app.getHttpAdapter().getInstance();
    httpApplication = adapterInstance as unknown as Application;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('serves liveness over HTTP', async () => {
    expect(httpApplication).toBeDefined();

    const response = await request(httpApplication!).get('/api/v1/health/live');

    console.log('STATUS:', response.status);
    console.log('BODY:', JSON.stringify(response.body, null, 2));
    console.log('TEXT:', response.text);
    console.log('HEADERS:', response.headers);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      checks: {
        application: {
          status: 'up',
        },
      },
    });
  });

  it('serves readiness over HTTP without exposing infrastructure details', async () => {
    expect(httpApplication).toBeDefined();

    const response = await request(httpApplication!).get(
      '/api/v1/health/ready',
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(JSON.stringify(response.body)).not.toMatch(
      /password|secret|mysql:\/\//i,
    );
  });
});
