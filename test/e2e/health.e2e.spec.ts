import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

describe('application health (e2e)', () => {
  let app: NestExpressApplication | undefined;

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('serves liveness over HTTP', async () => {
    const response = await request(app!.getHttpServer()).get(
      '/api/v1/health/live',
    );

    console.error('LIVENESS RESPONSE', {
      status: response.status,
      body: response.body,
      text: response.text,
      headers: response.headers,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      checks: { application: { status: 'up' } },
    });
  });

  it('serves readiness over HTTP without exposing infrastructure details', async () => {
    const response = await request(app!.getHttpServer()).get(
      '/api/v1/health/ready',
    );

    console.error('READINESS RESPONSE', {
      status: response.status,
      body: response.body,
      text: response.text,
      headers: response.headers,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(JSON.stringify(response.body)).not.toMatch(
      /password|secret|mysql:\/\//i,
    );
  });
});
