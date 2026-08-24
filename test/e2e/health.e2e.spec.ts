import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

describe('application health (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.APP_PORT = '3001';

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

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: 'v1',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness over HTTP', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/health/live',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      checks: { application: { status: 'up' } },
    });
  });

  it('serves readiness over HTTP without exposing infrastructure details', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/health/ready',
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(JSON.stringify(response.body)).not.toMatch(
      /password|secret|mysql:\/\//i,
    );
  });
});
