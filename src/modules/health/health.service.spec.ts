import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { DATABASE_HEALTH_CHECK } from './health.dependencies.js';
import { HealthService } from './health.service.js';

const createService = async (check: ReturnType<typeof vi.fn>) => {
  const module = await Test.createTestingModule({
    providers: [
      HealthService,
      {
        provide: DATABASE_HEALTH_CHECK,
        useValue: { check },
      },
    ],
  }).compile();

  return module.get(HealthService);
};

describe('HealthService', () => {
  it('returns liveness without touching the database', async () => {
    const check = vi.fn();
    const service = await createService(check);

    expect(service.liveness()).toEqual({
      status: 'ok',
      checks: {
        application: { status: 'up' },
      },
    });
    expect(check).not.toHaveBeenCalled();
  });

  it('returns readiness when the database probe succeeds', async () => {
    const check = vi.fn().mockResolvedValue(undefined);
    const service = await createService(check);

    await expect(service.readiness()).resolves.toEqual({
      status: 'ok',
      checks: {
        application: { status: 'up' },
        database: { status: 'up' },
      },
    });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('returns a safe readiness failure when the database probe fails', async () => {
    const check = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const service = await createService(check);

    await expect(service.readiness()).resolves.toEqual({
      status: 'error',
      checks: {
        application: { status: 'up' },
        database: { status: 'down' },
      },
    });
  });
});
