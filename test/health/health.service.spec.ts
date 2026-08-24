import { describe, expect, it, vi } from 'vitest';

import { HealthService } from '../../src/modules/health/health.service.js';

describe('HealthService', () => {
  it('reports liveness without touching the database', () => {
    const databaseHealth = { check: vi.fn() };
    const service = new HealthService(databaseHealth as never);

    expect(service.liveness()).toEqual({
      status: 'ok',
      checks: { application: { status: 'up' } },
    });
    expect(databaseHealth.check).not.toHaveBeenCalled();
  });

  it('reports readiness when the database is healthy', async () => {
    const databaseHealth = { check: vi.fn().mockResolvedValue(undefined) };
    const service = new HealthService(databaseHealth as never);

    await expect(service.readiness()).resolves.toEqual({
      status: 'ok',
      checks: {
        application: { status: 'up' },
        database: { status: 'up' },
      },
    });
  });

  it('reports a machine-readable failure when the database is unavailable', async () => {
    const databaseHealth = {
      check: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const service = new HealthService(databaseHealth as never);

    await expect(service.readiness()).resolves.toEqual({
      status: 'error',
      checks: {
        application: { status: 'up' },
        database: { status: 'down' },
      },
    });
  });
});
