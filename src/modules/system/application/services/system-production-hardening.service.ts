import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import { SystemIntegrationReliabilityService } from './system-integration-reliability.service.js';
import { SystemIntegrationService } from './system-integration.service.js';

const MAX_ROWS = 100;
const MAX_RANGE_DAYS = 90;

type MetricRow = {
  bucket: string;
  state: string | null;
  count: bigint | number;
  retries?: bigint | number | null;
  failures?: bigint | number | null;
  averageLatencyMs?: number | string | null;
};

type IntegrationMetricOptions = {
  from?: Date;
  to?: Date;
  granularity?: 'hour' | 'day' | 'week';
};

@Injectable()
export class SystemProductionHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: SystemIntegrationService,
    private readonly reliability: SystemIntegrationReliabilityService,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async integrationMetrics(options: IntegrationMetricOptions = {}) {
    const range = this.range(options.from, options.to);
    const granularity = options.granularity ?? 'day';
    const bucket = this.bucketFormat(granularity);
    const rows = await this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      SELECT
        DATE_FORMAT(o.created_at, ${bucket}) AS bucket,
        o.state AS state,
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN o.attempt > 1 THEN 1 ELSE 0 END), 0) AS retries,
        COALESCE(SUM(CASE WHEN o.state = 'FAILED' THEN 1 ELSE 0 END), 0) AS failures,
        AVG(
          CASE
            WHEN o.completed_at IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MICROSECOND, o.created_at, o.completed_at) / 1000
          END
        ) AS averageLatencyMs
      FROM system_integration_operations o
      WHERE o.created_at >= ${range.from}
        AND o.created_at < ${range.to}
      GROUP BY bucket, o.state
      ORDER BY bucket ASC, o.state ASC
    `);

    const series = new Map<
      string,
      {
        total: number;
        states: Record<string, number>;
        retries: number;
        failures: number;
        latencyTotal: number;
        latencyCount: number;
      }
    >();
    for (const row of rows) {
      const state = row.state ?? 'UNKNOWN';
      const count = this.toNumber(row.count);
      const current = series.get(row.bucket) ?? {
        total: 0,
        states: {},
        retries: 0,
        failures: 0,
        latencyTotal: 0,
        latencyCount: 0,
      };
      current.total += count;
      current.states[state] = (current.states[state] ?? 0) + count;
      current.retries += this.toNumber(row.retries);
      current.failures += this.toNumber(row.failures);
      const latency = this.toNumber(row.averageLatencyMs);
      if (latency > 0) {
        current.latencyTotal += latency * count;
        current.latencyCount += count;
      }
      series.set(row.bucket, current);
    }

    let total = 0;
    let retries = 0;
    let failures = 0;
    let latencyTotal = 0;
    let latencyCount = 0;
    const states: Record<string, number> = {};
    for (const item of series.values()) {
      total += item.total;
      retries += item.retries;
      failures += item.failures;
      latencyTotal += item.latencyTotal;
      latencyCount += item.latencyCount;
      for (const [state, count] of Object.entries(item.states))
        states[state] = (states[state] ?? 0) + count;
    }

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      granularity,
      total,
      throughputPerHour:
        total /
        Math.max(1, (range.to.getTime() - range.from.getTime()) / 3_600_000),
      states,
      retries,
      failures,
      errorRate: total ? failures / total : 0,
      averageLatencyMs: latencyCount
        ? Math.round(latencyTotal / latencyCount)
        : 0,
      series: [...series.entries()].map(([date, item]) => ({
        date,
        total: item.total,
        states: item.states,
        retries: item.retries,
        failures: item.failures,
        averageLatencyMs: item.latencyCount
          ? Math.round(item.latencyTotal / item.latencyCount)
          : 0,
      })),
    };
  }

  async jobMetrics(options: IntegrationMetricOptions = {}) {
    const range = this.range(options.from, options.to);
    const granularity = options.granularity ?? 'day';
    const bucket = this.bucketFormat(granularity);
    const rows = await this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      SELECT
        DATE_FORMAT(createdAt, ${bucket}) AS bucket,
        state AS state,
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN attemptCount > 1 THEN 1 ELSE 0 END), 0) AS retries,
        COALESCE(SUM(CASE WHEN state IN ('FAILED', 'DEAD_LETTER') THEN 1 ELSE 0 END), 0) AS failures,
        AVG(
          CASE
            WHEN completedAt IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MICROSECOND, createdAt, completedAt) / 1000
          END
        ) AS averageLatencyMs
      FROM automation_workflow_executions
      WHERE createdAt >= ${range.from}
        AND createdAt < ${range.to}
      GROUP BY bucket, state
      ORDER BY bucket ASC, state ASC
    `;
    return this.aggregateMetricRows(rows, range, granularity);
  }

  async integrationHealth() {
    const list = await this.integrations.list(1, MAX_ROWS);
    const checks = await Promise.all(
      list.items.map(async (integration) => ({
        uuid: integration.uuid,
        providerKey: integration.providerKey,
        state: integration.state,
        health: await this.reliability.providerHealth(integration.uuid),
      })),
    );
    return {
      status: checks.every((item) => item.health.status === 'UP')
        ? 'UP'
        : checks.some((item) => item.health.status === 'DOWN')
          ? 'DOWN'
          : 'DEGRADED',
      checkedAt: new Date().toISOString(),
      items: checks,
    };
  }

  async externalDependencyHealth() {
    const integration = await this.integrationHealth();
    let database: 'UP' | 'DOWN' = 'UP';
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
    } catch {
      database = 'DOWN';
    }
    return {
      status:
        database === 'DOWN' || integration.status === 'DOWN'
          ? 'DOWN'
          : integration.status === 'DEGRADED'
            ? 'DEGRADED'
            : 'UP',
      checkedAt: new Date().toISOString(),
      dependencies: {
        database,
        integrations: integration.status,
      },
    };
  }

  async retryFailedOperations(
    input: { dryRun?: boolean; limit?: number },
    actorUuid: string,
  ) {
    const limit = Math.min(MAX_ROWS, Math.max(1, input.limit ?? 25));
    const rows = await this.prisma.systemIntegrationOperation.findMany({
      where: { state: 'FAILED' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    if (input.dryRun !== false)
      return {
        dryRun: true,
        count: rows.length,
        operations: rows.map((row) => ({
          uuid: row.uuid,
          state: row.state,
          attempt: row.attempt,
          maxAttempts: row.maxAttempts,
        })),
      };

    const retryable = rows.filter((row) => row.attempt < row.maxAttempts);
    const now = new Date();
    for (const row of retryable) {
      await this.prisma.systemIntegrationOperation.update({
        where: { uuid: row.uuid },
        data: {
          state: 'RETRY_SCHEDULED',
          nextAttemptAt: now,
          errorCode: null,
          errorMessage: null,
        },
      });
    }
    await this.audit.record({
      action: 'SYSTEM_OPERATION_RETRIED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_integration_operation',
      entityUuid: actorUuid,
      result: 'SUCCESS',
      reason: `retry-failed-operations count=${retryable.length}`,
    });
    return {
      dryRun: false,
      count: retryable.length,
      skippedMaxAttempts: rows.length - retryable.length,
    };
  }

  async operationalCommands() {
    return {
      commands: [
        { key: 'cache-invalidate', destructive: true, requiresAudit: true },
        { key: 'orphan-cleanup', destructive: true, requiresAudit: true },
        {
          key: 'retry-failed-operations',
          destructive: true,
          requiresAudit: true,
        },
        { key: 'diagnostics', destructive: false, requiresAudit: false },
      ],
      safeDefaults: { dryRun: true, maxBatch: 25 },
    };
  }

  async orphanCleanup(
    input: { dryRun?: boolean; olderThanHours?: number },
    actorUuid: string,
  ) {
    const hours = Math.min(
      24 * 365,
      Math.max(1, input.olderThanHours ?? 24),
    );
    const cutoff = new Date(Date.now() - hours * 3_600_000);
    const candidates = await this.prisma.systemIntegrationOperation.findMany({
      where: { state: 'FAILED', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: 25,
      select: { uuid: true, createdAt: true, state: true },
    });
    if (input.dryRun !== false)
      return { dryRun: true, cutoff: cutoff.toISOString(), candidates };
    const deleted = await this.prisma.systemIntegrationOperation.deleteMany({
      where: {
        state: 'FAILED',
        createdAt: { lt: cutoff },
        attempt: { gte: 999999 },
      },
    });
    await this.audit.record({
      action: 'SYSTEM_OPERATION_CLEANUP',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_integration_operation',
      entityUuid: actorUuid,
      result: 'SUCCESS',
      reason: `orphan-cleanup deleted=${deleted.count};cutoff=${cutoff.toISOString()}`,
    });
    return {
      dryRun: false,
      deleted: deleted.count,
      cutoff: cutoff.toISOString(),
    };
  }

  private aggregateMetricRows(
    rows: MetricRow[],
    range: { from: Date; to: Date },
    granularity: 'hour' | 'day' | 'week',
  ) {
    const series = new Map<
      string,
      {
        total: number;
        states: Record<string, number>;
        retries: number;
        failures: number;
        latencyTotal: number;
        latencyCount: number;
      }
    >();
    for (const row of rows) {
      const current = series.get(row.bucket) ?? {
        total: 0,
        states: {},
        retries: 0,
        failures: 0,
        latencyTotal: 0,
        latencyCount: 0,
      };
      const count = this.toNumber(row.count);
      current.total += count;
      const state = row.state ?? 'UNKNOWN';
      current.states[state] = (current.states[state] ?? 0) + count;
      current.retries += this.toNumber(row.retries);
      current.failures += this.toNumber(row.failures);
      const latency = this.toNumber(row.averageLatencyMs);
      if (latency > 0) {
        current.latencyTotal += latency * count;
        current.latencyCount += count;
      }
      series.set(row.bucket, current);
    }
    const items = [...series.entries()].map(([date, item]) => ({
      date,
      total: item.total,
      states: item.states,
      retries: item.retries,
      failures: item.failures,
      averageLatencyMs: item.latencyCount
        ? Math.round(item.latencyTotal / item.latencyCount)
        : 0,
    }));
    const total = items.reduce((sum, item) => sum + item.total, 0);
    const failures = items.reduce((sum, item) => sum + item.failures, 0);
    const retries = items.reduce((sum, item) => sum + item.retries, 0);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      granularity,
      total,
      retries,
      failures,
      errorRate: total ? failures / total : 0,
      throughputPerHour:
        total /
        Math.max(1, (range.to.getTime() - range.from.getTime()) / 3_600_000),
      series: items,
    };
  }

  private range(from?: Date, to?: Date) {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 86_400_000);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start >= end
    )
      throw new Error('Invalid observability date range');
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 86_400_000)
      throw new Error(
        `Observability range cannot exceed ${MAX_RANGE_DAYS} days`,
      );
    return { from: start, to: end };
  }

  private bucketFormat(granularity: 'hour' | 'day' | 'week') {
    if (granularity === 'hour') return '%Y-%m-%dT%H:00:00.000Z';
    if (granularity === 'week') return '%x-W%v';
    return '%Y-%m-%d';
  }

  private toNumber(value: bigint | number | string | null | undefined) {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
