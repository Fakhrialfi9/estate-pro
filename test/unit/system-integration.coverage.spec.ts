import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemIntegrationService } from '../../src/modules/system/application/services/system-integration.service.js';

const row = {
  id: 11n,
  uuid: 'integration-1',
  providerKey: 'crm',
  providerVersion: '1.0.0',
  capabilities: ['TEST', 'SYNC', 'RECONNECT'],
  state: 'ACTIVE',
  metadata: { tenant: 'demo' },
  secretRef: 'vault://secret',
  lastTestAt: null,
  lastSyncAt: null,
  errorCode: null,
  errorMessage: null,
};

const provider = {
  key: 'crm',
  version: '1.0.0',
  capabilities: ['TEST', 'SYNC', 'RECONNECT'],
  testConnection: vi.fn().mockResolvedValue({ ok: true, latencyMs: 12 }),
  reconnect: vi.fn().mockResolvedValue({ ok: true }),
  health: vi.fn().mockResolvedValue({ ok: true }),
  sync: vi.fn().mockResolvedValue({
    state: 'SUCCEEDED',
    recordsRead: 10,
    recordsChanged: 2,
  }),
};

const dependencies = () => ({
  repository: {
    get: vi.fn().mockResolvedValue(row),
    list: vi.fn().mockResolvedValue({ items: [row], total: 1 }),
    create: vi.fn().mockImplementation(
      (input: Record<string, unknown>) => ({
        ...row,
        ...input,
      }),
    ),
    update: vi.fn().mockImplementation(
      (_uuid: string, input: Record<string, unknown>) => ({
        ...row,
        ...input,
      }),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  roadmap: {
    runtime: {
      getOrCreate: vi.fn().mockResolvedValue({
        syncDirection: 'BIDIRECTIONAL',
        syncCursor: 'c1',
        lastSyncedAt: null,
      }),
    },
    operation: {
      getByIdempotency: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        uuid: 'operation-1',
        state: 'RUNNING',
      }),
      update: vi.fn().mockResolvedValue({
        uuid: 'operation-1',
        state: 'SUCCEEDED',
      }),
    },
    conflict: { list: vi.fn().mockResolvedValue([]) },
  },
  audit: { record: vi.fn().mockResolvedValue(undefined) },
});

describe('SystemIntegrationService coverage', () => {
  let d: ReturnType<typeof dependencies>;
  let service: SystemIntegrationService;

  beforeEach(() => {
    d = dependencies();
    service = new SystemIntegrationService(
      d.repository as never,
      d.roadmap as never,
      d.audit as never,
    );
    service.registerProvider(provider as never);
  });

  it('covers provider registry and resolution', async () => {
    expect(service.registry()).toEqual([
      {
        key: 'crm',
        version: '1.0.0',
        capabilities: ['TEST', 'SYNC', 'RECONNECT'],
      },
    ]);
    await expect(service.providerFor('integration-1')).resolves.toBe(provider);
    await expect(service.runtimeFor('integration-1')).resolves.toMatchObject({
      syncDirection: 'BIDIRECTIONAL',
    });
    expect(() =>
      service.registerProvider({ key: '', version: '1', capabilities: [] } as never),
    ).toThrow('Integration provider identity is required');
    await expect(service.providerFor('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('covers create, list, get, configuration, update and remove', async () => {
    d.repository.list.mockResolvedValueOnce({ items: [], total: 0 });
    const created = await service.create('actor-1', {
      providerKey: 'crm',
      providerVersion: '1.0.0',
      metadata: { token: 'should-remove', keep: 'yes' },
      secretRef: 'vault://secret',
    });
    expect(created).toMatchObject({
      state: 'CONFIGURED',
      metadata: { keep: 'yes' },
    });

    d.repository.list.mockResolvedValueOnce({ items: [row], total: 1 });
    await expect(
      service.create('actor-1', {
        providerKey: 'crm',
        providerVersion: '1.0.0',
        metadata: {},
      }),
    ).resolves.toMatchObject({ uuid: 'integration-1' });
    await expect(service.list(0, 200, 'ACTIVE')).resolves.toMatchObject({
      page: 1,
      limit: 100,
      total: 1,
    });
    await expect(service.get('integration-1')).resolves.toMatchObject({
      uuid: 'integration-1',
    });
    d.repository.get.mockResolvedValueOnce(null);
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.providerConfiguration('integration-1'),
    ).resolves.toEqual({
      metadata: row.metadata,
      secretRef: row.secretRef,
    });
    await expect(
      service.update('actor-1', 'integration-1', {
        metadata: { password: 'secret', region: 'id' },
        secretRef: null,
        enabled: false,
      }),
    ).resolves.toMatchObject({
      state: 'DISABLED',
      metadata: { region: 'id' },
    });
    await expect(service.remove('actor-1', 'integration-1')).resolves.toBeUndefined();
  });

  it('covers connection and reconnect success/failure semantics', async () => {
    await expect(service.test('actor-1', 'integration-1')).resolves.toMatchObject({
      uuid: 'integration-1',
      ok: true,
      latencyMs: 12,
      code: null,
    });
    provider.testConnection.mockResolvedValueOnce({
      ok: false,
      code: 'TIMEOUT',
      message: 'timeout',
    });
    await expect(service.test('actor-1', 'integration-1')).resolves.toMatchObject({
      ok: false,
      code: 'TIMEOUT',
    });

    d.repository.get.mockResolvedValueOnce({ ...row, state: 'DISABLED' });
    await expect(
      service.reconnect('actor-1', 'integration-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    d.repository.get.mockResolvedValueOnce({ ...row, state: 'CONNECTING' });
    await expect(
      service.reconnect('actor-1', 'integration-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    d.repository.get.mockResolvedValue(row);
    d.roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      uuid: 'existing',
      state: 'SUCCEEDED',
    });
    await expect(
      service.reconnect('actor-1', 'integration-1', 'key-1'),
    ).resolves.toMatchObject({ idempotentReplay: true });

    d.roadmap.operation.getByIdempotency.mockResolvedValueOnce(null);
    await expect(
      service.reconnect('actor-1', 'integration-1', 'key-2'),
    ).resolves.toMatchObject({
      ok: true,
      state: 'ACTIVE',
      idempotentReplay: false,
    });
  });

  it('covers idempotency conflict, provider absence and sync/reconciliation', async () => {
    d.roadmap.operation.getByIdempotency.mockResolvedValueOnce({
      uuid: 'existing',
      state: 'RUNNING',
    });
    await expect(
      service.reconnect('actor-1', 'integration-1', 'key-3'),
    ).rejects.toBeInstanceOf(ConflictException);

    const noSync = { ...provider, sync: undefined };
    const serviceWithoutSync = new SystemIntegrationService(
      d.repository as never,
      d.roadmap as never,
      d.audit as never,
    );
    serviceWithoutSync.registerProvider(noSync as never);
    await expect(
      serviceWithoutSync.sync('actor-1', 'integration-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.sync('actor-1', 'integration-1'),
    ).resolves.toMatchObject({
      state: 'SUCCEEDED',
      recordsRead: 10,
      recordsChanged: 2,
    });
    await expect(
      service.reconciliation('integration-1'),
    ).resolves.toMatchObject({
      status: 'IN_SYNC',
      destructiveChanges: false,
    });
    d.roadmap.conflict.list.mockResolvedValueOnce([{ status: 'OPEN' }]);
    await expect(
      service.reconciliation('integration-1'),
    ).resolves.toMatchObject({
      status: 'CONFLICTS_FOUND',
    });
  });
});
