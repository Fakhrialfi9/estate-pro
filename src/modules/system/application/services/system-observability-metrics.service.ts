import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { SystemMetricsService } from '../../infrastructure/observability/system-metrics.service.js';

const MAX_DAYS = 90;
const MAX_ROWS = 100;
type Granularity = 'hour' | 'day' | 'week';

type StateRow = {
  bucket: string;
  state: string | null;
  count: bigint | number;
  retries?: bigint | number;
  failures?: bigint | number;
  averageLatencyMs?: number | string | null;
};

@Injectable()
export class SystemObservabilityMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: SystemMetricsService,
  ) {}

  async systemMetrics(
    from?: Date,
    to?: Date,
    granularity: Granularity = 'day',
  ) {
    const range = this.range(from, to);
    const started = performance.now();
    let database = { status: 'UP' as const, latencyMs: 0 };
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      database.latencyMs = Math.round(performance.now() - started);
    } catch {
      database = {
        status: 'DOWN',
        latencyMs: Math.round(performance.now() - started),
      };
    }
    const [application, queues, integrations, webhooks] = await Promise.all([
      this.auditResultCounts(range.from, range.to),
      this.queueStateCounts(),
      this.stateCounts('system_integration_operations', range.from, range.to),
      this.stateCounts('system_webhook_deliveries', range.from, range.to),
    ]);
    const http = this.http.httpSnapshotView();
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
      queues,
      integrations,
      webhooks,
    };
  }

  async jobMetrics(from?: Date, to?: Date, granularity: Granularity = 'day') {
    const range = this.range(from, to);
    const rows = await this.stateSeries(
      'automation_workflow_executions',
      'attempt_count',
      range,
      granularity,
    );
    return this.aggregate(rows, range, granularity);
  }

  async webhookMetrics(
    from?: Date,
    to?: Date,
    granularity: Granularity = 'day',
  ) {
    const range = this.range(from, to);
    const rows = await this.stateSeries(
      'system_webhook_deliveries',
      'attempt_count',
      range,
      granularity,
    );
    return this.aggregate(rows, range, granularity);
  }

  async integrationMetrics(
    from?: Date,
    to?: Date,
    granularity: Granularity = 'day',
  ) {
    const range = this.range(from, to);
    const rows = await this.stateSeries(
      'system_integration_operations',
      'attempt',
      range,
      granularity,
    );
    return this.aggregate(rows, range, granularity);
  }

  async importExportMetrics(
    from?: Date,
    to?: Date,
    granularity: Granularity = 'day',
  ) {
    const range = this.range(from, to);
    const [imports, exports] = await Promise.all([
      this.stateSeries('system_import_jobs', null, range, granularity).then(
        (rows) => this.aggregate(rows, range, granularity),
      ),
      this.stateSeries('system_export_jobs', null, range, granularity).then(
        (rows) => this.aggregate(rows, range, granularity),
      ),
    ]);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      granularity,
      imports,
      exports,
    };
  }

  async errorTracking(from?: Date, to?: Date) {
    const range = this.range(from, to);
    const [integration, audit] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          errorCode: string | null;
          errorMessage: string | null;
          count: bigint | number;
          lastSeen: Date;
        }>
      >(Prisma.sql`
        SELECT error_code AS errorCode, MAX(error_message) AS errorMessage,
               COUNT(*) AS count, MAX(updated_at) AS lastSeen
        FROM system_integration_operations
        WHERE state = 'FAILED' AND created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY error_code ORDER BY count DESC, lastSeen DESC LIMIT ${MAX_ROWS}`),
      this.prisma.$queryRaw<
        Array<{
          action: string;
          reason: string | null;
          count: bigint | number;
          lastSeen: Date;
        }>
      >(Prisma.sql`
        SELECT action, MAX(reason) AS reason, COUNT(*) AS count, MAX(created_at) AS lastSeen
        FROM audit_logs
        WHERE result = 'FAILURE' AND created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY action ORDER BY count DESC, lastSeen DESC LIMIT ${MAX_ROWS}`),
    ]);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      integration: integration.map((row) => ({
        errorCode: row.errorCode ?? 'UNKNOWN',
        message: redact(row.errorMessage),
        count: number(row.count),
        lastSeen: row.lastSeen.toISOString(),
      })),
      audit: audit.map((row) => ({
        action: row.action,
        reason: redact(row.reason),
        count: number(row.count),
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
        SELECT 'audit' source, request_id correlationId, COUNT(*) events,
               SUM(result = 'FAILURE') failures, MIN(created_at) firstSeen, MAX(created_at) lastSeen
        FROM audit_logs
        WHERE request_id IS NOT NULL AND request_id <> ''
          AND created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY request_id
        UNION ALL
        SELECT 'activity', request_id, COUNT(*), 0, MIN(created_at), MAX(created_at)
        FROM system_activities
        WHERE request_id IS NOT NULL AND request_id <> ''
          AND created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY request_id
        UNION ALL
        SELECT 'integration',
               COALESCE(
                 NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.correlationId')), ''),
                 JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.requestId'))
               ),
               COUNT(*), SUM(state = 'FAILED'), MIN(created_at), MAX(created_at)
        FROM system_integration_operations
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
          AND (
            JSON_EXTRACT(metadata, '$.correlationId') IS NOT NULL OR
            JSON_EXTRACT(metadata, '$.requestId') IS NOT NULL
          )
        GROUP BY correlationId
        UNION ALL
        SELECT 'job',
               COALESCE(
                 NULLIF(JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.correlationId')), ''),
                 JSON_UNQUOTE(JSON_EXTRACT(context_snapshot, '$.requestId'))
               ),
               COUNT(*), SUM(state IN ('FAILED','DEAD_LETTER')), MIN(created_at), MAX(created_at)
        FROM automation_workflow_executions
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
          AND (
            JSON_EXTRACT(context_snapshot, '$.correlationId') IS NOT NULL OR
            JSON_EXTRACT(context_snapshot, '$.requestId') IS NOT NULL
          )
        GROUP BY correlationId
      ) c
      WHERE correlationId IS NOT NULL AND correlationId <> ''
      GROUP BY source, correlationId
      ORDER BY lastSeen DESC
      LIMIT ${MAX_ROWS}`);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      correlations: rows.map((row) => ({
        correlationId: row.correlationId,
        source: row.source,
        events: number(row.events),
        failures: number(row.failures),
        firstSeen: row.firstSeen.toISOString(),
        lastSeen: row.lastSeen.toISOString(),
      })),
    };
  }

  private async auditResultCounts(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{ result: string; count: bigint | number }>
    >(Prisma.sql`
      SELECT result, COUNT(*) AS count
      FROM audit_logs
      WHERE created_at >= ${from} AND created_at < ${to}
      GROUP BY result`);
    const states = Object.fromEntries(
      rows.map((row) => [row.result, number(row.count)]),
    );
    const total = Object.values(states).reduce((sum, value) => sum + value, 0);
    const failures = states.FAILURE ?? 0;
    return {
      total,
      failures,
      errorRate: total ? failures / total : 0,
      states,
    };
  }

  private async queueStateCounts() {
    return this.stateCounts(
      'automation_workflow_executions',
      new Date(0),
      new Date('2999-01-01T00:00:00Z'),
    );
  }

  private async stateCounts(table: string, from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{ state: string | null; count: bigint | number }>
    >(Prisma.sql`
      SELECT state, COUNT(*) AS count
      FROM ${Prisma.raw(table)}
      WHERE created_at >= ${from} AND created_at < ${to}
      GROUP BY state`);
    const states = Object.fromEntries(
      rows.map((row) => [row.state ?? 'UNKNOWN', number(row.count)]),
    );
    const total = Object.values(states).reduce((sum, value) => sum + value, 0);
    const failures = ['FAILED', 'FAILURE', 'DEAD_LETTER', 'DLQ'].reduce(
      (sum, key) => sum + (states[key] ?? 0),
      0,
    );
    return {
      total,
      failures,
      errorRate: total ? failures / total : 0,
      states,
    };
  }

  private async stateSeries(
    table: string,
    attemptColumn: string | null,
    range: { from: Date; to: Date },
    granularity: Granularity,
  ) {
    const bucket = this.bucket(granularity);
    const retryExpr = attemptColumn
      ? `COALESCE(SUM(CASE WHEN ${attemptColumn} > 1 THEN 1 ELSE 0 END), 0)`
      : '0';
    const failureExpr =
      table === 'system_webhook_deliveries'
        ? 'COALESCE(SUM(CASE WHEN http_status >= 400 THEN 1 ELSE 0 END), 0)'
        : "COALESCE(SUM(CASE WHEN state IN ('FAILED','DEAD_LETTER','DLQ') THEN 1 ELSE 0 END), 0)";
    return this.prisma.$queryRaw<StateRow[]>(Prisma.sql`
      SELECT DATE_FORMAT(created_at, ${bucket}) AS bucket, state, COUNT(*) AS count,
             ${Prisma.raw(retryExpr)} AS retries, ${Prisma.raw(failureExpr)} AS failures,
             AVG(CASE WHEN completed_at IS NULL THEN NULL
                      ELSE TIMESTAMPDIFF(MICROSECOND, created_at, completed_at)/1000 END) AS averageLatencyMs
      FROM ${Prisma.raw(table)}
      WHERE created_at >= ${range.from} AND created_at < ${range.to}
      GROUP BY bucket, state ORDER BY bucket ASC, state ASC`);
  }

  private aggregate(
    rows: StateRow[],
    range: { from: Date; to: Date },
    granularity: Granularity,
  ) {
    const series = new Map<
      string,
      {
        total: number;
        states: Record<string, number>;
        retries: number;
        failures: number;
        latency: number;
        latencyCount: number;
      }
    >();
    for (const row of rows) {
      const state = row.state ?? 'UNKNOWN';
      const item = series.get(row.bucket) ?? {
        total: 0,
        states: {},
        retries: 0,
        failures: 0,
        latency: 0,
        latencyCount: 0,
      };
      const count = number(row.count);
      item.total += count;
      item.states[state] = (item.states[state] ?? 0) + count;
      item.retries += number(row.retries);
      item.failures += number(row.failures);
      const latency = number(row.averageLatencyMs);
      if (latency > 0) {
        item.latency += latency * count;
        item.latencyCount += count;
      }
      series.set(row.bucket, item);
    }
    const items = [...series.entries()].map(([date, item]) => ({
      date,
      total: item.total,
      states: item.states,
      retries: item.retries,
      failures: item.failures,
      averageLatencyMs: item.latencyCount
        ? Math.round(item.latency / item.latencyCount)
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
      averageLatencyMs: items.length
        ? Math.round(
            items.reduce((sum, item) => sum + item.averageLatencyMs, 0) /
              items.length,
          )
        : 0,
      series: items,
    };
  }

  private bucket(granularity: Granularity) {
    if (granularity === 'hour') return '%Y-%m-%dT%H:00:00.000Z';
    if (granularity === 'week') return '%x-W%v';
    return '%Y-%m-%d';
  }

  private range(from?: Date, to?: Date) {
    return rangeOf(from, to);
  }
}

function rangeOf(from?: Date, to?: Date) {
  const end = to ?? new Date();
  const start = from ?? new Date(end.getTime() - 86_400_000);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end
  ) {
    throw new BadRequestException('Invalid observability date range');
  }
  if (end.getTime() - start.getTime() > MAX_DAYS * 86_400_000) {
    throw new BadRequestException(
      `Observability range cannot exceed ${MAX_DAYS} days`,
    );
  }
  return { from: start, to: end };
}

function number(value: bigint | number | string | null | undefined) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function redact(value: string | null) {
  return value
    ? value
        .replace(
          /(token|secret|password|cookie|authorization)\s*[:=]\s*[^\s,;]+/gi,
          '$1=[REDACTED]',
        )
        .slice(0, 240)
    : null;
}
