import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import { HealthService } from './health.service.js';

const createService = async (queryRaw: ReturnType<typeof vi.fn>) => {
  const module = await Test.createTestingModule({
    providers: [HealthService, PrismaService],
  })
    .overrideProvider(PrismaService)
    .useValue({ $queryRaw: queryRaw })
    .compile();

  return module.get(HealthService);
};

describe('HealthService', () => {
  it('returns liveness without touching the database', async () => {
    const queryRaw = vi.fn();
    const service = await createService(queryRaw);

    expect(service.liveness()).toEqual({
      status: 'ok',
      checks: {
        application: { status: 'up' },
      },
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns readiness when the database probe succeeds', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const service = await createService(queryRaw);

    await expect(service.readiness()).resolves.toEqual({
      status: 'ok',
      checks: {
        application: { status: 'up' },
        database: { status: 'up' },
      },
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns a safe readiness failure when the database probe fails', async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const service = await createService(queryRaw);

    await expect(service.readiness()).resolves.toEqual({
      status: 'error',
      checks: {
        application: { status: 'up' },
        database: { status: 'down' },
      },
    });
  });
});
