import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemOperationsService } from '../../src/modules/system/application/services/system-operations.service.js';

const now = new Date('2026-01-01T00:00:00.000Z');

type Setting = {
  uuid: string;
  value: string;
  updatedAt: Date;
  version: number;
};

const dependencies = () => ({
  settings: {
    get: vi.fn().mockImplementation((key: string): Setting => {
      if (key === 'system.maintenance_mode') {
        return {
          uuid: 'maintenance-1',
          value: 'true',
          updatedAt: now,
          version: 2,
        };
      }
      return {
        uuid: 'readonly-1',
        value: 'false',
        updatedAt: new Date(now.getTime() - 1000),
        version: 1,
      };
    }),
    upsert: vi.fn().mockResolvedValue(undefined),
  },
  audit: {
    record: vi.fn().mockResolvedValue(undefined),
  },
  storageHealth: {
    check: vi.fn().mockResolvedValue('up'),
  },
  jobHealth: {
    check: vi.fn().mockResolvedValue('up'),
  },
  databaseHealth: {
    check: vi.fn().mockResolvedValue('up'),
  },
  integrations: {
    list: vi.fn().mockResolvedValue({
      total: 0,
      items: [],
    }),
  },
});

describe('SystemOperationsService coverage', () => {
  let d: ReturnType<typeof dependencies>;
  let service: SystemOperationsService;

  beforeEach(() => {
    d = dependencies();
    service = new SystemOperationsService(
      d.settings as never,
      d.audit,
      d.storageHealth,
      d.jobHealth,
      d.databaseHealth,
      d.integrations as never,
    );
  });

  it('returns current maintenance/read-only operational state', async () => {
    await expect(service.state()).resolves.toEqual({
      maintenanceMode: true,
      readOnlyMode: false,
      updatedAt: now.toISOString(),
    });
  });

  it('updates maintenance and read-only modes with optimistic version and audit', async () => {
    await expect(
      service.setMaintenance('actor-1', false),
    ).resolves.toMatchObject({ maintenanceMode: true });
    expect(d.settings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'system.maintenance_mode',
        value: 'false',
        expectedVersion: 2,
      }),
    );
    expect(d.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUuid: 'actor-1',
        reason: 'maintenanceMode=false',
      }),
    );

    await expect(service.setReadOnly('actor-1', true)).resolves.toMatchObject({
      readOnlyMode: false,
    });
    expect(d.settings.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: 'system.read_only_mode',
        value: 'true',
        expectedVersion: 1,
      }),
    );
  });

  it('derives healthy and degraded diagnostics', async () => {
    await expect(service.diagnostics()).resolves.toEqual({
      status: 'ok',
      maintenanceMode: true,
      readOnlyMode: false,
      components: {
        database: 'up',
        storage: 'up',
        jobs: 'up',
        integrations: 'up',
      },
    });

    d.storageHealth.check.mockResolvedValueOnce('down');
    await expect(service.diagnostics()).resolves.toMatchObject({
      status: 'degraded',
      components: expect.objectContaining({ storage: 'down' }),
    });

    d.integrations.list.mockResolvedValueOnce({
      total: 1,
      items: [{ state: 'ERROR' }],
    });
    await expect(service.diagnostics()).resolves.toMatchObject({
      status: 'degraded',
      components: expect.objectContaining({ integrations: 'down' }),
    });

    d.integrations.list.mockRejectedValueOnce(new Error('integration timeout'));
    await expect(service.diagnostics()).resolves.toMatchObject({
      components: expect.objectContaining({ integrations: 'unknown' }),
    });
  });
});
