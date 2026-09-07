import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { SystemMetricsService } from '../../system/infrastructure/observability/system-metrics.service.js';

const MAX_RANGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CORRELATIONS = 100;

type Granularity = 'hour' | 'day' | 'week';

type MetricRow = {
  bucket: string;
  state: string | null;
  count: bigint | number;
  retries?: bigint | number | null;
  failures?: bigint | number | null;
  averageLatencyMs?: number | string | null;
};

@Injectable()
export class SystemObservabilityMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: SystemMetricsService,
  ) {}

  async systemMetrics(from?: Date, to?: Date, granularity: Granularity = 'day') {
    const range = this.range(from, to);
    const started = performance.now();
    let database: { status: 'UP' | 'DOWN'; latencyMs: number } = {
      status: 'UP',
      latencyMs: 0,
    };
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      database.latencyMs = Math.round(performance.now() - started);
    } catch {
      database = { status: 'DOWN', latencyMs: Math.round(performance.now() - started) };
    }

    const [application, queue, integration, webhook] = await Promise.all([
      this.countApplicationEvents(range.from, range.to),
      this.queueMetrics(),
      this.integrationTotals(range.from, range.to),
      this.webhookTotals(range.from, range.to),
    ]);
    const http = this.metrics.httpSnapshotView();

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      granularity,
      generatedAt: new Date().toISOString(),
      http: {
        ...http,
        scope: 'process-lifetime',
        errorRate: http.requests ? http.errors / http.requests : 0,
      },
      database,
      application,
      queues: queue,
      integrations: integration,
      webhooks: webhook,
    };
  }

  async jobMetrics(from?: Date, to?: Date, granularity: Granularity = 'day') {
    const range = this.range(from, to);
    const rows = await this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      SELECT
        DATE_FORMAT(created_at, ${this.bucketFormat(granularity)}) AS bucket,
        state AS state,
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN attempt_count > 1 THEN 1 ELSE 0 END), 0) AS retries,
        COALESCE(SUM(CASE WHEN state IN ('FAILED', 'DEAD_LETTER') THEN 1 ELSE 0 END), 0) AS failures,
        AVG(
          CASE
            WHEN completed_at IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MICROSECOND, created_at, completed_at) / 1000
          END
        ) AS averageLatencyMs
      FROM automation_workflow_executions
      WHERE created_at >= ${range.from} AND created_at < ${range.to}
      GROUP BY bucket, state
      ORDER BY bucket ASC, state ASC
    `;
    return this.aggregate(rows, range, granularity);
  }

  async webhookMetrics(
    from?: Date,
    to?: Date,
    granularity: Granularity = 'day',
  ) {
    const range = this.range(from, to);
    const rows = await this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      SELECT
        DATE_FORMAT(created_at, ${this.bucketFormat(granularity)}) AS bucket,
        state AS state,
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN attempt_count > 1 THEN 1 ELSE 0 END), 0) AS retries,
        COALESCE(SUM(CASE WHEN http_status >= 400 THEN 1 ELSE 0 END), 0) AS failures,
        AVG(
          CASE
            WHEN completed_at IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MICROSECOND, created_at, completed_at) / 1000
          END
        ) AS averageLatencyMs
      FROM system_webhook_deliveries
      WHERE created_at >= ${range.from} AND created_at < ${range.to}
      GROUP BY bucket, state
      ORDER BY bucket ASC, state ASC
    `;
    return this.aggregate(rows, range, granularity);
  }

  async integrationMetrics(
    from?: Date,
    to?: Date,
    granularity: Granularity = 'day',
  ) {
    const range = this.range(from, to);
    const rows = await this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      SELECT
        DATE_FORMAT(created_at, ${this.bucketFormat(granularity)}) AS bucket,
        state AS state,
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN attempt > 1 THEN 1 ELSE 0 END), 0) AS retries,
        COALESCE(SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END), 0) AS failures,
        AVG(
          CASE
            WHEN completed_at IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MICROSECOND, created_at, completed_at) / 1000
          END
        ) AS averageLatencyMs
      FROM system_integration_operations
      WHERE created_at >= ${range.from} AND created_at < ${range.to}
      GROUP BY bucket, state
      ORDER BY bucket ASC, state ASC
    `;
    return this.aggregate(rows, range, granularity);
  }

  async importExportMetrics(from?: Date, to?: Date, granularity: Granularity = 'day') {
    const range = this.range(from, to);
    const [imports, exports] = await Promise.all([
      this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
        SELECT
          DATE_FORMAT(created_at, ${this.bucketFormat(granularity)}) AS bucket,
          state AS state,
          COUNT(*) AS count,
          COALESCE(SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END), 0) AS failures
        FROM system_import_jobs
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY bucket, state
        ORDER BY bucket ASC, state ASC
      `),
      this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
        SELECT
          DATE_FORMAT(created_at, ${this.bucketFormat(granularity)}) AS bucket,
          state AS state,
          COUNT(*) AS count,
          COALESCE(SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END), 0) AS failures
        FROM system_export_jobs
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY bucket, state
        ORDER BY bucket ASC, state ASC
      `),
    ]);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      granularity,
      imports: this.aggregate(imports, range, granularity),
      exports: this.aggregate(exports, range, granularity),
    };
  }

  async errorTracking(from?: Date, to?: Date) {
    const range = this.range(from, to);
    const [integrationErrors, auditFailures] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ errorCode: string | null; errorMessage: string | null; count: bigint | number; lastSeen: Date }>
      >(Prisma.sql`
        SELECT
          error_code AS errorCode,
          MAX(error_message) AS errorMessage,
          COUNT(*) AS count,
          MAX(updated_at) AS lastSeen
        FROM system_integration_operations
        WHERE state = 'FAILED'
          AND created_at >= ${range.from}
          AND created_at < ${range.to}
        GROUP BY error_code
        ORDER BY count DESC, lastSeen DESC
        LIMIT 100
      `),
      this.prisma.$queryRaw<
        Array<{ action: string; result: string; reason: string | null; count: bigint | number; lastSeen: Date }>
      >(Prisma.sql`
        SELECT action, result, MAX(reason) AS reason, COUNT(*) AS count, MAX(created_at) AS lastSeen
        FROM audit_logs
        WHERE result = 'FAILURE'
          AND created_at >= ${range.from}
          AND created_at < ${range.to}
        GROUP BY action, result
        ORDER BY count DESC, lastSeen DESC
        LIMIT 100
      `),
    ]);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      integration: integrationErrors.map((row) => ({
        errorCode: row.errorCode ?? 'UNKNOWN',
        message: redact(row.errorMessage),
        count: this.toNumber(row.count),
        lastSeen: row.lastSeen.toISOString(),
      })),
      audit: auditFailures.map((row) => ({
        action: row.action,
        result: row.result,
        reason: redact(row.reason),
        count: this.toNumber(row.count),
        lastSeen: row.lastSeen.toISOString(),
      })),
    };
  }

  async auditCorrelation(from?: Date, to?: Date) {
    const range = this.range(from, to);
    const rows = await this.prisma.$queryRaw<
      Array<{
        source: string;
        correlationId: string;
        events: bigint | number;
        failures: bigint | number;
        firstSeen: Date;
        lastSeen: Date;
      }>
    >(Prisma.sql`
      SELECT source, correlationId, SUM(events) AS events, SUM(failures) AS failures,
             MIN(firstSeen) AS firstSeen, MAX(lastSeen) AS lastSeen
      FROM (
        SELECT 'audit' AS source, request_id AS correlationId, COUNT(*) AS events,
               SUM(CASE WHEN result = 'FAILURE' THEN 1 ELSE 0 END) AS failures,
               MIN(created_at) AS firstSeen, MAX(created_at) AS lastSeen
        FROM audit_logs
        WHERE request_id IS NOT NULL AND request_id <> ''
          AND created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY request_id
        UNION ALL
        SELECT 'activity' AS source, request_id AS correlationId, COUNT(*) AS events,
               0 AS failures, MIN(created_at) AS firstSeen, MAX(created_at) AS lastSeen
        FROM system_activities
        WHERE request_id IS NOT NULL AND request_id <> ''
          AND created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY request_id
        UNION ALL
        SELECT 'integration' AS source,
               COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.correlationId')), ''),
                        JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.requestId'))) AS correlationId,
               COUNT(*) AS events,
               SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END) AS failures,
               MIN(created_at) AS firstSeen, MAX(created_at) AS lastSeen
        FROM system_integration_operations
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
          AND COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.correlationId')), ''),
                       JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.requestId'))) IS NOT NULL
        GROUP BY correlationId
        UNION ALL
        SELECT 'job' AS source,
               COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.correlationId')), ''),
                        JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.requestId'))) AS correlationId,
               COUNT(*) AS events,
               SUM(CASE WHEN state IN ('FAILED', 'DEAD_LETTER') THEN 1 ELSE 0 END) AS failures,
               MIN(created_at) AS firstSeen, MAX(created_at) AS lastSeen
        FROM automation_workflow_executions
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
          AND COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.correlationId')), ''),
                       JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.requestId'))) IS NOT NULL
        GROUP BY correlationId
      ) correlated
      WHERE correlationId IS NOT NULL AND correlationId <> ''
      GROUP BY source, correlationId
      ORDER BY lastSeen DESC
      LIMIT ${MAX_CORRELATIONS}
    `);

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      correlations: rows.map((row) => ({
        correlationId: row.correlationId,
        source: row.source,
        events: this.toNumber(row.events),
        failures: this.toNumber(row.failures),
        firstSeen: row.firstSeen.toISOString(),
        lastSeen: row.lastSeen.toISOString(),
      })),
    };
  }

  private async countApplicationEvents(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{ result: string; count: bigint | number }>
    >(Prisma.sql`
      SELECT result, COUNT(*) AS count
      FROM audit_logs
      WHERE created_at >= ${from} AND created_at < ${to}
      GROUP BY result
    `);
    const counts = Object.fromEntries(
      rows.map((row) => [row.result, this.toNumber(row.count)]),
    );
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const failures = counts.FAILURE ?? 0;
    return {
      total,
      failures,
      errorRate: total ? failures / total : 0,
      results: counts,
    };
  }

  private async queueMetrics() {
    const rows = await this.prisma.$queryRaw<
      Array<{ state: string; count: bigint | number }>
    >(Prisma.sql`
      SELECT state, COUNT(*) AS count
      FROM automation_workflow_executions
      GROUP BY state
    `);
    return {
      states: Object.fromEntries(
        rows.map((row) => [row.state, this.toNumber(row.count)]),
      ),
      backlog: rows
        .filter((row) => ['PENDING', 'RETRY_SCHEDULED', 'RUNNING'].includes(row.state))
        .reduce((sum, row) => sum + this.toNumber(row.count), 0),
    };
  }

  private async integrationTotals(from: Date, to: Date) {
    return this.totalStateMetrics('system_integration_operations', from, to);
  }

  private async webhookTotals(from: Date, to: Date) {
    return this.totalStateMetrics('system_webhook_deliveries', from, to);
  }

  private async totalStateMetrics(table: string, from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{ state: string; count: bigint | number }>
    >(Prisma.sql`SELECT state, COUNT(*) AS count FROM ${Prisma.raw(table)} WHERE created_at >= ${from} AND created_at < ${to} GROUP BY state`);
    const states = Object.fromEntries(
      rows.map((row) => [row.state, this.toNumber(row.count)]),
    );
    const total = Object.values(states).reduce((sum, value) => sum + value, 0);
    const failures = ['FAILED', 'DLQ', 'DEAD_LETTER'].reduce(
      (sum, state) => sum + (states[state] ?? 0),
      0,
    );
    return { total, failures, errorRate: total ? failures / total : 0, states };
  }

  private aggregate(rows: MetricRow[], range: { from: Date; to: Date }, granularity: Granularity) {
    const series = new Map<string, { total: number; states: Record<string, number>; retries: number; failures: number; latencyTotal: number; latencyCount: number }>();
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
      averageLatencyMs: item.latencyCount ? Math.round(item.latencyTotal / item.latencyCount) : 0,
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
      throughputPerHour: total / Math.max(1, (range.to.getTime() - range.from.getTime()) / 3_600_000),
      averageLatencyMs: items.reduce((sum, item) => sum + item.averageLatencyMs, 0) / Math.max(1, items.length),
      series: items,
    };
  }

  private range(from?: Date, to?: Date) {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - DAY_MS);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end)
      throw new BadRequestException('Invalid observability date range');
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS)
      throw new BadRequestException(`Observability range cannot exceed ${MAX_RANGE_DAYS} days`);
    return { from: start, to: end };
  }

  private bucketFormat(granularity: Granularity) {
    if (granularity === 'hour') return '%Y-%m-%dT%H:00:00.000Z';
    if (granularity === 'week') return '%x-W%v';
    return '%Y-%m-%d';
  }

  private toNumber(value: bigint | number | string | null | undefined): number {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}

function redact(value: string | null): string | null {
  return value
    ? value
        .replace(
          /(token|secret|password|cookie|authorization)\s*[:=]\s*[^\s,;]+/gi,
          '$1=[REDACTED]',
        )
        .slice(0, 240)
    : null;
}
