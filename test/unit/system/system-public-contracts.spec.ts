import { describe, expect, it } from 'vitest';
import type {
  SystemActivityContract,
  SystemJobsContract,
  SystemNotificationsContract,
  SystemSettingsContract,
} from '../../../src/modules/system/domain/system-public.contracts.js';

describe('System public contracts', () => {
  it('keeps settings contract narrow and framework-independent', () => {
    const contract: SystemSettingsContract = {
      list: async () => ({
        items: [],
        meta: { page: 1, limit: 25, total: 0, totalPages: 0 },
      }),
      get: async (key) => ({
        key,
        scope: 'GLOBAL',
        scopeKey: 'global',
        valueType: 'STRING',
        value: 'value',
      }),
      update: async (key) => ({
        key,
        value: 'value',
        version: 1,
        updatedAt: new Date(),
      }),
    };

    expect(contract).toBeDefined();
    expect(typeof contract.list).toBe('function');
    expect(typeof contract.get).toBe('function');
    expect(typeof contract.update).toBe('function');
  });

  it('keeps activity contract explicit', () => {
    const contract: SystemActivityContract = {
      append: async () => ({
        uuid: '00000000-0000-4000-8000-000000000000',
        actorUuid: null,
        eventType: 'SYSTEM_TEST',
        category: 'SYSTEM',
        resourceType: null,
        resourceUuid: null,
        summary: 'test',
        metadata: {},
        requestId: null,
        createdAt: new Date(),
      }),
      list: async () => ({ items: [], total: 0 }),
    };

    expect(typeof contract.append).toBe('function');
    expect(typeof contract.list).toBe('function');
  });

  it('keeps notification and job contracts delegated to external owners', () => {
    const notifications: SystemNotificationsContract = {
      list: async () => ({ items: [] }),
      markRead: async () => undefined,
    };
    const jobs: SystemJobsContract = {
      list: async () => ({ items: [] }),
      get: async () => undefined,
      retry: async () => undefined,
      cancel: async () => undefined,
    };

    expect(typeof notifications.list).toBe('function');
    expect(typeof notifications.markRead).toBe('function');
    expect(typeof jobs.list).toBe('function');
    expect(typeof jobs.retry).toBe('function');
    expect(typeof jobs.cancel).toBe('function');
  });
});
