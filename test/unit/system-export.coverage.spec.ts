import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemExportService } from '../../src/modules/system/application/services/system-export.service.js';
import type {
  SystemExportJobRecord,
  SystemExportRepository,
} from '../../src/modules/system/domain/repositories/system-export.repository.js';

const config = {
  get: vi.fn((key: string, fallback?: unknown) => fallback),
};

const activity = (overrides: Record<string, unknown> = {}) => ({
  uuid: 'a1',
  actorUuid: 'actor-1',
  eventType: 'LOGIN',
  category: 'AUTH',
  resourceType: null,
  resourceUuid: null,
  summary: 'hello, world',
  metadata: { ok: true, count: 1 },
  requestId: 'req-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const job = (
  overrides: Partial<SystemExportJobRecord> = {},
): SystemExportJobRecord => ({
  uuid: 'job-1',
  actorUuid: 'actor-1',
  entity: 'system_activity',
  format: 'csv',
  state: 'FAILED',
  filters: { limit: 10, columns: ['uuid', 'summary'] },
  estimatedRows: 2,
  expiresAt: new Date(Date.now() + 60_000),
  downloadTokenHash: null,
  artifactPath: 'exports/job-1.csv',
  rows: 2,
  processedRows: 2,
  completedAt: null,
  cancelledAt: null,
  cancelRequested: false,
  artifactBytes: null,
  errorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const digest = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

const deps = () => ({
  jobs: {
    countRunning: vi
      .fn<SystemExportRepository['countRunning']>()
      .mockResolvedValue(0),
    create: vi
      .fn<SystemExportRepository['create']>()
      .mockImplementation(async (input) =>
        job({
          ...(input as Partial<SystemExportJobRecord>),
          state: 'QUEUED',
          artifactPath: null,
          rows: 0,
          processedRows: 0,
        }),
      ),
    claimQueued: vi
      .fn<SystemExportRepository['claimQueued']>()
      .mockResolvedValue(null),
    findByUuid: vi
      .fn<SystemExportRepository['findByUuid']>()
      .mockResolvedValue(job()),
    list: vi.fn<SystemExportRepository['list']>().mockResolvedValue({
      items: [job()],
      total: 1,
    }),
    listExpired: vi
      .fn<SystemExportRepository['listExpired']>()
      .mockResolvedValue([job()]),
    update: vi
      .fn<SystemExportRepository['update']>()
      .mockImplementation(async (_uuid, input) =>
        job({
          ...(input as Partial<SystemExportJobRecord>),
          state: (input as Partial<SystemExportJobRecord>).state ?? 'RUNNING',
        }),
      ),
    deleteMany: vi
      .fn<SystemExportRepository['deleteMany']>()
      .mockResolvedValue(undefined),
  },
  activity: {
    list: vi.fn().mockResolvedValue({
      total: 2,
      items: [activity()],
    }),
  },
  storage: {
    remove: vi.fn().mockResolvedValue(undefined),
    putStream: vi.fn().mockResolvedValue({ path: 'exports/job-1.csv' }),
    size: vi.fn().mockResolvedValue(100),
    stream: vi.fn().mockReturnValue('stream'),
  },
  audit: { record: vi.fn().mockResolvedValue(undefined) },
  xlsx: { build: vi.fn().mockReturnValue(Buffer.from('xlsx')) },
});

const consume = async (stream: AsyncIterable<unknown>): Promise<string> => {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk),
    );
  }
  return chunks.join('');
};

describe('SystemExportService coverage', () => {
  let d: ReturnType<typeof deps>;
  let service: SystemExportService;

  beforeEach(() => {
    d = deps();
    config.get.mockImplementation(
      (_key: string, fallback?: unknown) => fallback,
    );
    service = new SystemExportService(
      d.jobs as never,
      d.activity as never,
      d.storage as never,
      d.audit,
      d.xlsx,
      config as never,
    );
  });

  it('covers execute filters, limits, concurrency and defaults', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'system.export.maxRows') return 10_000;
      if (key === 'system.export.maxConcurrent') return 2;
      if (key === 'system.export.retentionHours') return 0;
      return fallback;
    });

    const result = await service.execute({
      actorUuid: 'actor-1',
      entity: 'system_activity',
      format: 'csv',
      limit: 50_000,
      columns: ['uuid', 'summary'],
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
      category: 'AUTH',
      eventType: 'LOGIN',
      sort: 'createdAt_asc',
    } as never);

    expect(result.downloadToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const input = d.jobs.create.mock.calls[0]?.[0];
    expect(input?.filters).toMatchObject({
      entity: 'system_activity',
      format: 'csv',
      limit: 10_000,
      actorUuid: 'actor-1',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      category: 'AUTH',
      eventType: 'LOGIN',
      sort: 'createdAt_asc',
      columns: ['uuid', 'summary'],
    });
    expect(input?.downloadTokenHash).toBe(digest(result.downloadToken));

    d.jobs.countRunning.mockResolvedValueOnce(2);
    await expect(
      service.execute({ actorUuid: 'actor-1' } as never),
    ).rejects.toMatchObject({ status: 429 });

    d.jobs.countRunning.mockResolvedValueOnce(0);
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'system.export.maxRows' ? 0 : fallback,
    );
    await expect(
      service.execute({ actorUuid: 'actor-1', limit: 0 } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    config.get.mockImplementation(
      (_key: string, fallback?: unknown) => fallback,
    );
    await service.execute({
      actorUuid: 'actor-1',
      entity: 'system_activity',
      format: 'json',
    } as never);
    expect(d.jobs.create.mock.calls.at(-1)?.[0].filters.columns).toHaveLength(
      10,
    );
  });

  it('covers get/list/retry behavior and failures', async () => {
    await expect(service.get('actor-1', 'job-1')).resolves.toMatchObject({
      uuid: 'job-1',
      state: 'FAILED',
    });

    d.jobs.findByUuid.mockResolvedValueOnce(null);
    await expect(service.get('actor-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    await expect(
      service.list('actor-1', 0, 200, 'FAILED'),
    ).resolves.toMatchObject({
      page: 1,
      limit: 100,
      total: 1,
    });

    const retry = await service.retry('actor-1', 'job-1');
    expect(retry.downloadToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(d.storage.remove).toHaveBeenCalledWith('exports/job-1.csv');

    d.jobs.findByUuid.mockResolvedValueOnce(null);
    await expect(service.retry('actor-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    d.jobs.findByUuid.mockResolvedValueOnce(job({ state: 'SUCCEEDED' }));
    await expect(service.retry('actor-1', 'job-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    d.jobs.findByUuid.mockResolvedValueOnce(
      job({ state: 'FAILED', artifactPath: null }),
    );
    d.jobs.countRunning.mockResolvedValueOnce(2);
    await expect(service.retry('actor-1', 'job-1')).rejects.toMatchObject({
      status: 429,
    });
  });

  it('covers cancel and cleanup branches', async () => {
    d.jobs.findByUuid.mockResolvedValueOnce(job({ state: 'QUEUED' }));
    await expect(service.cancel('actor-1', 'job-1')).resolves.toMatchObject({
      state: 'CANCELLED',
    });

    d.jobs.findByUuid.mockResolvedValueOnce(job({ state: 'RUNNING' }));
    await expect(service.cancel('actor-1', 'job-1')).resolves.toMatchObject({
      state: 'RUNNING',
    });
    expect(d.jobs.update).toHaveBeenCalledWith('job-1', {
      cancelRequested: true,
    });

    for (const state of ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const) {
      d.jobs.findByUuid.mockResolvedValueOnce(job({ state }));
      await expect(service.cancel('actor-1', 'job-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }

    d.jobs.findByUuid.mockResolvedValueOnce(null);
    await expect(service.cancel('actor-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    d.jobs.listExpired.mockResolvedValueOnce([]);
    await expect(service.cleanup(0)).resolves.toEqual({
      scanned: 0,
      deleted: 0,
    });
    d.jobs.listExpired.mockResolvedValueOnce([
      job({ artifactPath: 'a' }),
      job({ uuid: 'job-2', artifactPath: null }),
    ]);
    await expect(service.cleanup(1000)).resolves.toEqual({
      scanned: 2,
      deleted: 2,
    });
    expect(d.storage.remove).toHaveBeenCalledWith('a');
    expect(d.jobs.deleteMany).toHaveBeenCalledWith(['job-1', 'job-2']);
  });

  it('covers download success, expiry and token validation', async () => {
    const token = 'download-token';

    for (const format of ['csv', 'xlsx', 'json'] as const) {
      d.jobs.findByUuid.mockResolvedValueOnce(
        job({
          state: 'SUCCEEDED',
          format,
          expiresAt: new Date(Date.now() + 60_000),
          downloadTokenHash: digest(token),
        }),
      );
      const result = await service.download('actor-1', 'job-1', token);
      expect(result.filename).toBe(`job-1.${format}`);
      expect(result.stream).toBe('stream');
    }

    for (const invalid of [
      null,
      job({ state: 'FAILED' }),
      job({ state: 'SUCCEEDED', artifactPath: null }),
      job({ state: 'SUCCEEDED', downloadTokenHash: null }),
    ]) {
      d.jobs.findByUuid.mockResolvedValueOnce(invalid);
      await expect(
        service.download('actor-1', 'job-1', token),
      ).rejects.toBeInstanceOf(NotFoundException);
    }

    d.jobs.findByUuid.mockResolvedValueOnce(
      job({
        state: 'SUCCEEDED',
        expiresAt: new Date(Date.now() - 1),
        downloadTokenHash: digest(token),
      }),
    );
    await expect(
      service.download('actor-1', 'job-1', token),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(d.storage.remove).toHaveBeenCalledWith('exports/job-1.csv');

    d.jobs.findByUuid.mockResolvedValueOnce(
      job({
        state: 'SUCCEEDED',
        downloadTokenHash: digest(token),
      }),
    );
    await expect(
      service.download('actor-1', 'job-1', 'wrong-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('covers CSV JSON XLSX processing and selected column behavior', async () => {
    d.storage.putStream.mockImplementation(
      async (_uuid, input: AsyncIterable<unknown>) => {
        const output = await consume(input);
        expect(output).toBeTruthy();
        return { path: 'exports/job-1.csv' };
      },
    );

    for (const format of ['csv', 'json', 'xlsx'] as const) {
      d.jobs.claimQueued.mockResolvedValueOnce(
        job({
          state: 'QUEUED',
          format,
          filters: {
            limit: 1,
            columns: format === 'csv' ? ['uuid', 'summary'] : undefined,
          },
          artifactPath: null,
        }),
      );
      d.jobs.findByUuid.mockResolvedValue(
        job({ processedRows: 1, cancelRequested: false }),
      );
      d.activity.list.mockResolvedValueOnce({
        total: 1,
        items: [activity()],
      });
      await expect(service.processQueued()).resolves.toBe(true);
    }

    expect(d.xlsx.build).toHaveBeenCalled();

    d.jobs.claimQueued.mockResolvedValueOnce(
      job({
        state: 'QUEUED',
        format: 'json',
        filters: {
          limit: 2,
          columns: ['uuid', 'summary', 'uuid', 'not-a-column'],
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-01-01T00:00:00.000Z',
          sort: 'unknown',
        },
      }),
    );
    d.jobs.findByUuid.mockResolvedValue(
      job({ processedRows: 1, cancelRequested: false }),
    );
    d.activity.list.mockResolvedValueOnce({
      total: 501,
      items: [
        activity({
          summary: '=-formula',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        }),
        activity({
          uuid: 'too-late',
          createdAt: new Date('2026-01-02T00:00:00Z'),
        }),
      ],
    });
    await expect(service.processQueued()).resolves.toBe(true);
    expect(d.activity.list).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'createdAt_desc' }),
    );
  });

  it('covers empty batches, invalid columns and CSV escaping values', async () => {
    d.storage.putStream.mockImplementation(
      async (_uuid, input: AsyncIterable<unknown>) => {
        const output = await consume(input);
        expect(output).toContain('uuid,actorUuid');
        return { path: 'exports/job-1.csv' };
      },
    );

    d.jobs.claimQueued.mockResolvedValueOnce(
      job({
        state: 'QUEUED',
        format: 'csv',
        filters: { limit: 1, columns: [] },
      }),
    );
    d.jobs.findByUuid.mockResolvedValue(
      job({ processedRows: 0, cancelRequested: false }),
    );
    d.activity.list.mockResolvedValueOnce({ total: 0, items: [] });
    await expect(service.processQueued()).resolves.toBe(true);

    for (const columns of ['not-array', ['nope']] as never[]) {
      d.jobs.claimQueued.mockResolvedValueOnce(
        job({
          state: 'QUEUED',
          format: 'csv',
          filters: { limit: 1, columns },
        }),
      );
      d.jobs.findByUuid.mockResolvedValue(
        job({ processedRows: 1, cancelRequested: false }),
      );
      d.activity.list.mockResolvedValueOnce({
        total: 1,
        items: [
          activity({
            actorUuid: null,
            summary: 'a,b\nc',
            metadata: 42,
            requestId: null,
          }),
        ],
      });
      await expect(service.processQueued()).resolves.toBe(true);
    }
  });

  it('covers processing failure and cancellation during streaming', async () => {
    d.storage.putStream.mockImplementation(
      async (_uuid, input: AsyncIterable<unknown>) => {
        await consume(input);
        return { path: 'exports/job-1.csv' };
      },
    );
    d.jobs.claimQueued.mockResolvedValueOnce(
      job({ state: 'QUEUED', filters: { limit: 1 } }),
    );
    d.jobs.findByUuid.mockResolvedValue(
      job({ processedRows: 1, cancelRequested: false }),
    );
    d.activity.list.mockResolvedValueOnce({ total: 1, items: [activity()] });
    d.storage.size.mockResolvedValueOnce(100);
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'system.export.maxArtifactBytes' ? 10 : fallback,
    );
    await expect(service.processQueued()).resolves.toBe(true);
    expect(d.storage.remove).toHaveBeenCalledWith('exports/job-1.csv');
    expect(d.jobs.update).toHaveBeenLastCalledWith(
      'job-1',
      expect.objectContaining({ state: 'FAILED' }),
    );

    d.jobs.claimQueued.mockResolvedValueOnce(
      job({ state: 'QUEUED', filters: { limit: 1 } }),
    );
    d.jobs.findByUuid.mockResolvedValue(
      job({ processedRows: 0, cancelRequested: false }),
    );
    d.storage.putStream.mockRejectedValueOnce('boom');
    await expect(service.processQueued()).resolves.toBe(true);
    expect(d.jobs.update).toHaveBeenLastCalledWith(
      'job-1',
      expect.objectContaining({
        state: 'FAILED',
        errorMessage: 'Export failed',
      }),
    );

    d.jobs.claimQueued.mockResolvedValueOnce(
      job({ state: 'QUEUED', filters: { limit: 2 } }),
    );
    d.jobs.findByUuid
      .mockResolvedValueOnce(job({ cancelRequested: false }))
      .mockResolvedValueOnce(job({ cancelRequested: true }));
    d.activity.list.mockResolvedValueOnce({
      total: 1,
      items: [activity()],
    });
    await expect(service.processQueued()).resolves.toBe(true);
    expect(d.jobs.update).toHaveBeenLastCalledWith(
      'job-1',
      expect.objectContaining({ state: 'CANCELLED' }),
    );
  });

  it('returns false when no queued export exists', async () => {
    d.jobs.claimQueued.mockResolvedValueOnce(null);
    await expect(service.processQueued()).resolves.toBe(false);
  });
});
