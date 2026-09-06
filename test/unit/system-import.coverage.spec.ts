import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemImportService } from '../../src/modules/system/application/services/system-import.service.js';

const now = new Date('2026-01-01T00:00:00.000Z');
const baseJob = {
  uuid: 'job-1',
  actorUuid: 'actor-1',
  filename: 'activity.csv',
  format: 'csv' as const,
  state: 'SUCCEEDED' as const,
  preview: false,
  idempotencyKey: 'key-1',
  columnMapping: [],
  fieldMapping: [],
  conflictStrategy: 'FAIL' as const,
  transactionStrategy: 'ROW' as const,
  totalRows: 1,
  processedRows: 1,
  failedRows: 0,
  errors: [],
  sourcePath: 'job-1/source',
  expiresAt: new Date('2026-01-02T00:00:00.000Z'),
  createdAt: now,
  updatedAt: now,
};

const dependencies = () => ({
  jobs: {
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      ...baseJob,
      state: 'QUEUED',
      totalRows: 0,
      processedRows: 0,
    }),
    update: vi
      .fn()
      .mockImplementation((_uuid: string, input: Record<string, unknown>) => ({
        ...baseJob,
        ...input,
      })),
    findByUuid: vi.fn().mockResolvedValue(baseJob),
    list: vi.fn().mockResolvedValue({ items: [baseJob], total: 1 }),
  },
  activity: {
    get: vi.fn().mockResolvedValue(null),
    append: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
    appendBatch: vi.fn().mockResolvedValue(undefined),
    upsertBatch: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    put: vi.fn().mockResolvedValue({ path: 'job-1/source' }),
    read: vi
      .fn()
      .mockResolvedValue(
        Buffer.from('eventType,category,summary\nFOLLOW_UP,CRM,hello\n'),
      ),
  },
  audit: { record: vi.fn().mockResolvedValue(undefined) },
  mapping: {
    validateFieldMapping: vi.fn(),
    validateColumnMapping: vi.fn(),
    applyColumnMapping: vi.fn((row: Record<string, unknown>) => row),
    applyFieldMapping: vi.fn((row: Record<string, unknown>) => row),
  },
});

describe('SystemImportService coverage', () => {
  let d: ReturnType<typeof dependencies>;
  let service: SystemImportService;

  beforeEach(() => {
    d = dependencies();
    service = new SystemImportService(
      d.jobs as never,
      d.activity as never,
      d.storage as never,
      d.audit,
      d.mapping as never,
    );
  });

  const csvRequest = (overrides: Record<string, unknown> = {}) => ({
    filename: 'activity.csv',
    contentBase64: Buffer.from(
      'eventType,category,summary\nFOLLOW_UP,CRM,hello\n',
    ).toString('base64'),
    format: 'csv',
    columnMapping: [],
    fieldMapping: [],
    conflictStrategy: 'FAIL',
    transactionStrategy: 'ROW',
    ...overrides,
  });

  it('executes a row import and records completion', async () => {
    const result = await service.execute('actor-1', csvRequest() as never);
    expect(result).toMatchObject({
      state: 'SUCCEEDED',
      totalRows: 1,
      processedRows: 1,
      failedRows: 0,
    });
    expect(d.storage.put).toHaveBeenCalled();
    expect(d.activity.append).toHaveBeenCalled();
    expect(d.audit.record).toHaveBeenCalled();
  });

  it('returns an existing idempotent import', async () => {
    d.jobs.findByIdempotencyKey.mockResolvedValueOnce(baseJob);
    await expect(
      service.execute('actor-1', csvRequest() as never),
    ).resolves.toMatchObject({ uuid: 'job-1' });
    expect(d.jobs.create).not.toHaveBeenCalled();
  });

  it('parses JSON imports', async () => {
    const json = Buffer.from(
      JSON.stringify([
        { eventType: 'FOLLOW_UP', category: 'CRM', summary: 'hello' },
      ]),
    ).toString('base64');
    await expect(
      service.execute(
        'actor-1',
        csvRequest({
          filename: 'activity.json',
          format: 'json',
          contentBase64: json,
        }) as never,
      ),
    ).resolves.toMatchObject({ state: 'SUCCEEDED' });
  });

  it('rejects invalid request prerequisites', async () => {
    await expect(service.execute('', csvRequest() as never)).rejects.toThrow(
      'Authenticated actor missing',
    );
    await expect(
      service.execute('actor-1', csvRequest({ contentBase64: '' }) as never),
    ).rejects.toThrow('Import content is required');
    await expect(
      service.execute(
        'actor-1',
        csvRequest({ filename: 'bad.txt', format: undefined }) as never,
      ),
    ).rejects.toThrow('Only CSV and JSON imports are supported');
  });

  it('marks malformed and invalid-row imports as failed', async () => {
    const malformed = Buffer.from(
      'eventType,"category\nFOLLOW_UP,CRM,hello',
    ).toString('base64');
    await expect(
      service.execute(
        'actor-1',
        csvRequest({ contentBase64: malformed }) as never,
      ),
    ).resolves.toMatchObject({ state: 'FAILED' });

    const invalidJson = Buffer.from('{bad json').toString('base64');
    await expect(
      service.execute(
        'actor-1',
        csvRequest({
          filename: 'x.json',
          format: 'json',
          contentBase64: invalidJson,
        }) as never,
      ),
    ).resolves.toMatchObject({ state: 'FAILED' });

    const invalidRow = Buffer.from(
      'eventType,category,summary\nFOLLOW_UP,,hello\n',
    ).toString('base64');
    await expect(
      service.execute(
        'actor-1',
        csvRequest({ contentBase64: invalidRow }) as never,
      ),
    ).resolves.toMatchObject({ state: 'FAILED' });
  });

  it('covers preview and conflict strategies', async () => {
    const preview = await service.execute(
      'actor-1',
      csvRequest({ preview: true }) as never,
    );
    expect(preview.processedRows).toBe(1);
    expect(d.activity.append).not.toHaveBeenCalled();

    d.activity.get.mockResolvedValueOnce({ uuid: 'existing-row' });
    await expect(
      service.execute(
        'actor-1',
        csvRequest({ conflictStrategy: 'FAIL' }) as never,
      ),
    ).resolves.toMatchObject({ state: 'FAILED' });

    d.jobs.create.mockResolvedValueOnce({ ...baseJob, state: 'QUEUED' });
    d.activity.get.mockResolvedValueOnce({ uuid: 'existing-row' });
    await expect(
      service.execute(
        'actor-1',
        csvRequest({ conflictStrategy: 'SKIP' }) as never,
      ),
    ).resolves.toMatchObject({ state: 'SUCCEEDED' });

    d.jobs.create.mockResolvedValueOnce({ ...baseJob, state: 'QUEUED' });
    d.activity.get.mockResolvedValueOnce({ uuid: 'existing-row' });
    await expect(
      service.execute(
        'actor-1',
        csvRequest({ conflictStrategy: 'UPDATE' }) as never,
      ),
    ).resolves.toMatchObject({ state: 'SUCCEEDED' });
    expect(d.activity.upsert).toHaveBeenCalled();
  });

  it('covers batch persistence and all-or-nothing imports', async () => {
    d.jobs.create.mockResolvedValueOnce({ ...baseJob, state: 'QUEUED' });
    await expect(
      service.execute(
        'actor-1',
        csvRequest({
          transactionStrategy: 'ALL_OR_NOTHING',
          conflictStrategy: 'UPDATE',
        }) as never,
      ),
    ).resolves.toMatchObject({ state: 'SUCCEEDED' });
    expect(d.activity.upsertBatch).toHaveBeenCalled();

    d.jobs.create.mockResolvedValueOnce({ ...baseJob, state: 'QUEUED' });
    d.activity.get.mockResolvedValueOnce({ uuid: 'existing-row' });
    await expect(
      service.execute(
        'actor-1',
        csvRequest({
          transactionStrategy: 'ALL_OR_NOTHING',
          conflictStrategy: 'FAIL',
        }) as never,
      ),
    ).resolves.toMatchObject({ state: 'FAILED' });
  });

  it('handles persistence failures', async () => {
    d.jobs.create.mockResolvedValueOnce({ ...baseJob, state: 'QUEUED' });
    d.activity.append.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      service.execute('actor-1', csvRequest() as never),
    ).resolves.toMatchObject({ state: 'FAILED', failedRows: 1 });

    d.jobs.create.mockResolvedValueOnce({ ...baseJob, state: 'QUEUED' });
    d.activity.appendBatch.mockRejectedValueOnce(new Error('batch failed'));
    await expect(
      service.execute(
        'actor-1',
        csvRequest({ transactionStrategy: 'BATCH' }) as never,
      ),
    ).resolves.toMatchObject({ state: 'FAILED' });
  });

  it('covers get, failed report, retry, cancel and list paths', async () => {
    await expect(service.get('actor-1', 'job-1')).resolves.toMatchObject({
      uuid: 'job-1',
    });
    d.jobs.findByUuid.mockResolvedValueOnce(null);
    await expect(service.get('actor-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    d.jobs.findByUuid.mockResolvedValueOnce(baseJob);
    await expect(
      service.failedRowReport('actor-1', 'job-1'),
    ).resolves.toMatchObject({ importUuid: 'job-1', failedRows: 0 });

    d.jobs.findByUuid.mockResolvedValueOnce(null);
    await expect(
      service.failedRowReport('actor-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);

    d.jobs.findByUuid.mockResolvedValueOnce({
      ...baseJob,
      state: 'SUCCEEDED',
    });
    await expect(service.retry('actor-1', 'job-1')).rejects.toThrow(
      'Import job is not retryable',
    );

    d.jobs.findByUuid.mockResolvedValueOnce({
      ...baseJob,
      state: 'FAILED',
      sourcePath: null,
    });
    await expect(service.retry('actor-1', 'job-1')).rejects.toThrow(
      'Original import source is unavailable',
    );

    d.jobs.findByUuid.mockResolvedValueOnce({
      ...baseJob,
      state: 'FAILED',
      expiresAt: new Date('2025-01-01'),
    });
    await expect(service.retry('actor-1', 'job-1')).rejects.toThrow(
      'Original import source has expired',
    );

    d.jobs.findByUuid.mockResolvedValueOnce({
      ...baseJob,
      state: 'RUNNING',
    });
    await expect(service.cancel('actor-1', 'job-1')).rejects.toThrow(
      'Import job is not cancellable',
    );
    d.jobs.findByUuid.mockResolvedValueOnce({
      ...baseJob,
      state: 'QUEUED',
    });
    await expect(service.cancel('actor-1', 'job-1')).resolves.toMatchObject({
      state: 'CANCELLED',
    });
    await expect(service.list('actor-1', 0, 200)).resolves.toMatchObject({
      page: 1,
      limit: 100,
      total: 1,
    });
  });
});
