import {
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemExportService } from '../../src/modules/system/application/services/system-export.service.js';

const config = {
  get: vi.fn((key: string, fallback?: unknown) => fallback),
};

const job = {
  uuid: 'job-1',
  actorUuid: 'actor-1',
  entity: 'activity',
  format: 'csv',
  state: 'FAILED',
  filters: { limit: 10, columns: ['uuid', 'summary'] },
  estimatedRows: 2,
  expiresAt: new Date(Date.now() + 60_000),
  downloadTokenHash: 'hash',
  artifactPath: 'exports/job-1.csv',
  rows: 2,
  processedRows: 2,
  completedAt: null,
  cancelledAt: null,
  cancelRequested: false,
  artifactBytes: null,
};

const dependencies = () => ({
  jobs: {
    countRunning: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({
      ...job,
      state: 'QUEUED',
      downloadTokenHash: 'unused',
    }),
    claimQueued: vi.fn().mockResolvedValue(null),
    findByUuid: vi.fn().mockResolvedValue(job),
    list: vi.fn().mockResolvedValue({ items: [job], total: 1 }),
    listExpired: vi.fn().mockResolvedValue([job]),
    update: vi.fn().mockImplementation(
      (_uuid: string, input: Record<string, unknown>) => ({
        ...job,
        ...input,
      }),
    ),
    deleteMany: vi.fn().mockResolvedValue(undefined),
  },
  activity: {
    list: vi.fn().mockResolvedValue({
      total: 2,
      items: [
        {
          uuid: 'a1',
          actorUuid: 'actor-1',
          eventType: 'LOGIN',
          category: 'AUTH',
          resourceType: null,
          resourceUuid: null,
          summary: 'hello',
          metadata: { ok: true },
          requestId: 'req-1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
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

describe('SystemExportService coverage', () => {
  let d: ReturnType<typeof dependencies>;
  let service: SystemExportService;

  beforeEach(() => {
    d = dependencies();
    config.get.mockImplementation((_key: string, fallback?: unknown) => fallback);
    service = new SystemExportService(
      d.jobs as never,
      d.activity as never,
      d.storage as never,
      d.audit as never,
      d.xlsx as never,
      config as never,
    );
  });

  it('creates export jobs with bounded filters and a download token', async () => {
    const result = await service.execute({
      actorUuid: 'actor-1',
      entity: 'activity',
      format: 'csv',
      limit: 50_000,
      columns: ['uuid', 'summary'],
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
      sort: 'createdAt_desc',
    } as never);

    expect(result.downloadToken).toEqual(expect.any(String));
    expect(d.jobs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUuid: 'actor-1',
        estimatedRows: 2,
        filters: expect.objectContaining({
          limit: 10_000,
          columns: ['uuid', 'summary'],
        }),
      }),
    );
    expect(d.audit.record).toHaveBeenCalled();
  });

  it('rejects concurrency and non-positive limits', async () => {
    d.jobs.countRunning.mockResolvedValueOnce(2);
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'system.export.maxConcurrent' ? 2 : fallback,
    );
    await expect(
      service.execute({ actorUuid: 'actor-1' } as never),
    ).rejects.toBeInstanceOf(HttpException);

    d.jobs.countRunning.mockResolvedValueOnce(0);
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'system.export.maxRows' ? 0 : fallback,
    );
    await expect(
      service.execute({ actorUuid: 'actor-1', limit: 0 } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('covers get/list/retry/cancel/cleanup paths', async () => {
    await expect(service.get('actor-1', 'job-1')).resolves.toMatchObject({
      uuid: 'job-1',
      state: 'FAILED',
    });
    d.jobs.findByUuid.mockResolvedValueOnce(null);
    await expect(service.get('actor-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    await expect(service.list('actor-1', 0, 200)).resolves.toMatchObject({
      page: 1,
      limit: 100,
      total: 1,
    });

    await expect(service.retry('actor-1', 'job-1')).resolves.toEqual(
      expect.objectContaining({ downloadToken: expect.any(String) }),
    );
    expect(d.storage.remove).toHaveBeenCalledWith(job.artifactPath);

    d.jobs.findByUuid.mockResolvedValueOnce({ ...job, state: 'SUCCEEDED' });
    await expect(service.retry('actor-1', 'job-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    d.jobs.findByUuid.mockResolvedValueOnce({ ...job, state: 'QUEUED' });
    await expect(service.cancel('actor-1', 'job-1')).resolves.toMatchObject({
      state: 'CANCELLED',
    });

    d.jobs.findByUuid.mockResolvedValueOnce({ ...job, state: 'RUNNING' });
    await expect(service.cancel('actor-1', 'job-1')).resolves.toMatchObject({
      cancelRequested: true,
    });

    d.jobs.listExpired.mockResolvedValueOnce([
      { ...job, artifactPath: 'a' },
      { ...job, uuid: 'job-2', artifactPath: null },
    ]);
    await expect(service.cleanup(0)).resolves.toEqual({
      scanned: 2,
      deleted: 2,
    });
    expect(d.jobs.deleteMany).toHaveBeenCalledWith(['job-1', 'job-2']);
  });

  it('validates download state and token expiration', async () => {
    const valid = await service.download('actor-1', 'job-1', 'token');
    expect(valid.filename).toBe('job-1.csv');
    expect(valid.stream).toBe('stream');

    d.jobs.findByUuid.mockResolvedValueOnce(null);
    await expect(
      service.download('actor-1', 'missing', 'token'),
    ).rejects.toBeInstanceOf(NotFoundException);

    d.jobs.findByUuid.mockResolvedValueOnce({
      ...job,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(
      service.download('actor-1', 'job-1', 'token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(d.storage.remove).toHaveBeenCalled();
  });

  it('handles queued processing and cancellation', async () => {
    d.jobs.claimQueued.mockResolvedValueOnce(null);
    await expect(service.processQueued()).resolves.toBe(false);

    d.jobs.claimQueued.mockResolvedValueOnce({
      ...job,
      state: 'QUEUED',
      format: 'csv',
    });
    d.activity.list.mockResolvedValue({
      total: 1,
      items: [
        {
          uuid: 'a1',
          actorUuid: 'actor-1',
          eventType: 'LOGIN',
          category: 'AUTH',
          resourceType: null,
          resourceUuid: null,
          summary: 'hello',
          metadata: {},
          requestId: null,
          createdAt: new Date(),
        },
      ],
      hasMore: false,
    });
    await expect(service.processQueued()).resolves.toBe(true);
    expect(d.jobs.update).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ state: 'RUNNING' }),
    );
  });
});
