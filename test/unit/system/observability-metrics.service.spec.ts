import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SystemObservabilityMetricsService } from '../../../src/modules/system/application/services/system-observability-metrics.service.js';

const prisma = {
  $queryRaw: vi.fn(),
};

const http = {
  httpSnapshotView: vi.fn(() => ({
    startedAt: '2026-01-01T00:00:00.000Z',
    requests: 10,
    errors: 2,
    averageLatencyMs: 25,
  })),
};

describe('SystemObservabilityMetricsService', () => {
  it('rejects an observability range beyond 90 days before querying', async () => {
    const service = new SystemObservabilityMetricsService(
      prisma,
      http as never,
    );
    const to = new Date('2026-04-01T00:00:00.000Z');
    const from = new Date('2025-12-01T00:00:00.000Z');

    await expect(service.systemMetrics(from, to)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns bounded system metrics with process-lifetime HTTP scope', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { result: 'SUCCESS', count: 8n },
        { result: 'FAILURE', count: 2n },
      ])
      .mockResolvedValueOnce([
        { state: 'PENDING', count: 3n },
        { state: 'SUCCEEDED', count: 7n },
      ])
      .mockResolvedValueOnce([{ state: 'SUCCEEDED', count: 4n }])
      .mockResolvedValueOnce([{ state: 'FAILED', count: 1n }]);

    const service = new SystemObservabilityMetricsService(
      prisma,
      http as never,
    );
    const result = await service.systemMetrics(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
      'day',
    );

    expect(result.http.scope).toBe('process-lifetime');
    expect(result.http.requests).toBe(10);
    expect(result.application.failures).toBe(2);
    expect(result.queues.states.PENDING).toBe(3);
    expect(result.integrations.failures).toBe(0);
    expect(result.webhooks.failures).toBe(1);
  });

  it('redacts secrets from aggregated error messages', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          errorCode: 'PROVIDER_AUTH',
          errorMessage: 'token=super-secret authorization=Bearer abc',
          count: 2n,
          lastSeen: new Date('2026-01-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          action: 'AUTH_FAILED',
          reason: 'password=secret-value',
          count: 1n,
          lastSeen: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

    const service = new SystemObservabilityMetricsService(
      prisma,
      http as never,
    );
    const result = await service.errorTracking(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    );

    expect(result.integration[0]?.message).not.toContain('super-secret');
    expect(result.integration[0]?.message).toContain('[REDACTED]');
    expect(result.audit[0]?.reason).not.toContain('secret-value');
  });
});
