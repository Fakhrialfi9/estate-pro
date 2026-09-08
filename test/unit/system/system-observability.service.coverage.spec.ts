import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SystemObservabilityService } from '../../../src/modules/system/application/services/system-observability.service.js';
import type { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';

const queryRows = [
  { bucket: '2026-01-01', count: 2n, rows: 10n, failedRows: 1n, succeeded: 1n, failed: 1n },
];

const prisma = {
  $queryRaw: vi.fn(),
} as unknown as PrismaService;

describe('SystemObservabilityService coverage', () => {
  it('covers import/export summary and bucket aggregation', async () => {
    const queryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;
    queryRaw
      .mockResolvedValueOnce([{ count: 2n, rows: 10n, failedRows: 1n, succeeded: 1n, failed: 1n }])
      .mockResolvedValueOnce([{ count: 1n, rows: 4n, bytes: 50n, succeeded: 1n, failed: 0n }])
      .mockResolvedValueOnce(queryRows)
      .mockResolvedValueOnce([{ bucket: '2026-01-01', count: 1n, rows: 4n, bytes: 50n, succeeded: 1n, failed: 0n }]);
    const service = new SystemObservabilityService(prisma);
    const result = await service.importExportMetrics(
      new Date('2026-01-01'),
      new Date('2026-01-02'),
      'day',
    );
    expect(result.summary.imports.processedRows).toBe(10);
    expect(result.summary.exports.artifactBytes).toBe(50);
    expect(result.series).toHaveLength(1);
  });

  it('covers delivery filtering, latency aggregation and empty branches', async () => {
    const queryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;
    queryRaw.mockResolvedValueOnce([
      { bucket: '2026-01-01', state: 'SUCCEEDED', count: 2n, retries: 1n, httpFailures: 0n, averageLatencyMs: 12 },
      { bucket: '2026-01-01', state: null, count: 1n, retries: 0n, httpFailures: 1n, averageLatencyMs: null },
    ]);
    const service = new SystemObservabilityService(prisma);
    await expect(
      service.deliveryMetrics(
        new Date('2026-01-01'),
        new Date('2026-01-02'),
        'sub-1',
        'hour',
      ),
    ).resolves.toMatchObject({
      subscriptionUuid: 'sub-1',
      total: 3,
      retries: 1,
      httpFailures: 1,
      averageLatencyMs: 12,
    });
  });

  it('rejects invalid and excessive ranges before querying', async () => {
    const queryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;
    queryRaw.mockClear();
    const service = new SystemObservabilityService(prisma);
    await expect(
      service.importExportMetrics(
        new Date('2026-01-02'),
        new Date('2026-01-01'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.deliveryMetrics(
        new Date('2025-01-01'),
        new Date('2026-01-01'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
