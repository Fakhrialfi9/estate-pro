import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';

const MAX_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRANULARITY = 'day' as const;
type ObservabilityGranularity = 'hour' | 'day' | 'week';

type MetricRow = {
  bucket: string;
  count: bigint | number;
  rows?: bigint | number | null;
  failedRows?: bigint | number | null;
  succeeded?: bigint | number | null;
  failed?: bigint | number | null;
  bytes?: bigint | number | null;
  retries?: bigint | number | null;
  httpFailures?: bigint | number | null;
  averageLatencyMs?: number | string | null;
  state?: string;
};

@Injectable()
export class SystemObservabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async importExportMetrics(
    from?: Date,
    to?: Date,
    granularity: ObservabilityGranularity = DEFAULT_GRANULARITY,
  ) {
    const range = this.range(from, to);
    const [importSummary, exportSummary, importSeries, exportSeries] =
      await Promise.all([
        this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
          SELECT
            COUNT(*) AS count,
            COALESCE(SUM(COALESCE(NULLIF(processed_rows, 0), total_rows)), 0) AS rows,
            COALESCE(SUM(failed_rows), 0) AS failedRows,
            COALESCE(SUM(CASE WHEN state = 'SUCCEEDED' THEN 1 ELSE 0 END), 0) AS succeeded,
            COALESCE(SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed
          FROM system_import_jobs
          WHERE created_at >= ${range.from} AND created_at < ${range.to}
        `),
        this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
          SELECT
            COUNT(*) AS count,
            COALESCE(SUM(COALESCE(NULLIF(processed_rows, 0), rows)), 0) AS rows,
            COALESCE(SUM(artifact_bytes), 0) AS bytes,
            COALESCE(SUM(CASE WHEN state = 'SUCCEEDED' THEN 1 ELSE 0 END), 0) AS succeeded,
            COALESCE(SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed
          FROM system_export_jobs
          WHERE created_at >= ${range.from} AND created_at < ${range.to}
        `),
        this.prisma.$queryRaw<MetricRow[]>(
          this.bucketedImportSql(range.from, range.to, granularity),
        ),
        this.prisma.$queryRaw<MetricRow[]>(
          this.bucketedExportSql(range.from, range.to, granularity),
        ),
      ]);

    const imports = importSummary[0] ?? this.emptyImportSummary();
    const exports = exportSummary[0] ?? this.emptyExportSummary();
    const byBucket = new Map<
      string,
      {
        imports: Record<string, number>;
        exports: Record<string, number>;
      }
    >();

    for (const row of importSeries) {
      byBucket.set(row.bucket, {
        imports: {
          count: this.toNumber(row.count),
          rows: this.toNumber(row.rows),
          failedRows: this.toNumber(row.failedRows),
          succeeded: this.toNumber(row.succeeded),
          failed: this.toNumber(row.failed),
        },
        exports: byBucket.get(row.bucket)?.exports ?? this.emptyExportBucket(),
      });
    }
    for (const row of exportSeries) {
      const existing = byBucket.get(row.bucket) ?? {
        imports: this.emptyImportBucket(),
        exports: this.emptyExportBucket(),
      };
      existing.exports = {
        count: this.toNumber(row.count),
        rows: this.toNumber(row.rows),
        bytes: this.toNumber(row.bytes),
        succeeded: this.toNumber(row.succeeded),
        failed: this.toNumber(row.failed),
      };
      byBucket.set(row.bucket, existing);
    }

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      granularity,
      summary: {
        imports: this.summarizeImportRow(imports),
        exports: this.summarizeExportRow(exports),
      },
      series: [...byBucket.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([bucket, value]) => ({ date: bucket, ...value })),
    };
  }

  async deliveryMetrics(
    from?: Date,
    to?: Date,
    subscriptionUuid?: string,
    granularity: ObservabilityGranularity = DEFAULT_GRANULARITY,
  ) {
    const range = this.range(from, to);
    const whereSubscription = subscriptionUuid
      ? Prisma.sql`AND s.uuid = ${subscriptionUuid}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      SELECT
        DATE_FORMAT(
          d.created_at,
          ${this.bucketFormat(granularity)}
        ) AS bucket,
        d.state AS state,
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN d.attempt_count > 1 THEN 1 ELSE 0 END), 0) AS retries,
        COALESCE(SUM(CASE WHEN d.http_status >= 400 THEN 1 ELSE 0 END), 0) AS httpFailures,
        AVG(
          CASE
            WHEN d.completed_at IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MICROSECOND, d.created_at, d.completed_at) / 1000
          END
        ) AS averageLatencyMs
      FROM system_webhook_deliveries d
      JOIN system_webhook_subscriptions s ON s.id = d.subscription_id
      WHERE d.created_at >= ${range.from}
        AND d.created_at < ${range.to}
        ${whereSubscription}
      GROUP BY bucket, d.state
      ORDER BY bucket ASC, d.state ASC
    `);

    const seriesMap = new Map<
      string,
      {
        states: Record<string, number>;
        total: number;
        retries: number;
        httpFailures: number;
        latencyTotal: number;
        latencyCount: number;
      }
    >();
    for (const row of rows) {
      const entry = seriesMap.get(row.bucket) ?? {
        states: {},
        total: 0,
        retries: 0,
        httpFailures: 0,
        latencyTotal: 0,
        latencyCount: 0,
      };
      const count = this.toNumber(row.count);
      const averageLatency = this.toNumber(row.averageLatencyMs);
      entry.states[row.state ?? 'UNKNOWN'] = count;
      entry.total += count;
      entry.retries += this.toNumber(row.retries);
      entry.httpFailures += this.toNumber(row.httpFailures);
      if (averageLatency > 0) {
        entry.latencyTotal += averageLatency * count;
        entry.latencyCount += count;
      }
      seriesMap.set(row.bucket, entry);
    }

    let total = 0;
    let retries = 0;
    let httpFailures = 0;
    let latencyTotal = 0;
    let latencyCount = 0;
    const states: Record<string, number> = {};
    for (const value of seriesMap.values()) {
      total += value.total;
      retries += value.retries;
      httpFailures += value.httpFailures;
      latencyTotal += value.latencyTotal;
      latencyCount += value.latencyCount;
      for (const [state, count] of Object.entries(value.states))
        states[state] = (states[state] ?? 0) + count;
    }

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      subscriptionUuid: subscriptionUuid ?? null,
      granularity,
      total,
      states,
      retries,
      httpFailures,
      averageLatencyMs: latencyCount
        ? Math.round(latencyTotal / latencyCount)
        : 0,
      series: [...seriesMap.entries()].map(([bucket, value]) => ({
        date: bucket,
        total: value.total,
        states: value.states,
        retries: value.retries,
        httpFailures: value.httpFailures,
        averageLatencyMs: value.latencyCount
          ? Math.round(value.latencyTotal / value.latencyCount)
          : 0,
      })),
    };
  }

  private bucketedImportSql(
    from: Date,
    to: Date,
    granularity: ObservabilityGranularity,
  ) {
    return Prisma.sql`
      SELECT
        DATE_FORMAT(created_at, ${this.bucketFormat(granularity)}) AS bucket,
        COUNT(*) AS count,
        COALESCE(SUM(COALESCE(NULLIF(processed_rows, 0), total_rows)), 0) AS rows,
        COALESCE(SUM(failed_rows), 0) AS failedRows,
        COALESCE(SUM(CASE WHEN state = 'SUCCEEDED' THEN 1 ELSE 0 END), 0) AS succeeded,
        COALESCE(SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed
      FROM system_import_jobs
      WHERE created_at >= ${from} AND created_at < ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  }

  private bucketedExportSql(
    from: Date,
    to: Date,
    granularity: ObservabilityGranularity,
  ) {
    return Prisma.sql`
      SELECT
        DATE_FORMAT(created_at, ${this.bucketFormat(granularity)}) AS bucket,
        COUNT(*) AS count,
        COALESCE(SUM(COALESCE(NULLIF(processed_rows, 0), rows)), 0) AS rows,
        COALESCE(SUM(artifact_bytes), 0) AS bytes,
        COALESCE(SUM(CASE WHEN state = 'SUCCEEDED' THEN 1 ELSE 0 END), 0) AS succeeded,
        COALESCE(SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed
      FROM system_export_jobs
      WHERE created_at >= ${from} AND created_at < ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  }

  private bucketFormat(granularity: ObservabilityGranularity): string {
    switch (granularity) {
      case 'hour':
        return '%Y-%m-%dT%H:00:00.000Z';
      case 'week':
        return '%x-W%v';
      default:
        return '%Y-%m-%d';
    }
  }

  private summarizeImportRow(row: MetricRow) {
    return {
      count: this.toNumber(row.count),
      succeeded: this.toNumber(row.succeeded),
      failed: this.toNumber(row.failed),
      processedRows: this.toNumber(row.rows),
      failedRows: this.toNumber(row.failedRows),
    };
  }

  private summarizeExportRow(row: MetricRow) {
    return {
      count: this.toNumber(row.count),
      succeeded: this.toNumber(row.succeeded),
      failed: this.toNumber(row.failed),
      processedRows: this.toNumber(row.rows),
      artifactBytes: this.toNumber(row.bytes),
    };
  }

  private emptyImportSummary(): MetricRow {
    return {
      bucket: '',
      count: 0,
      rows: 0,
      failedRows: 0,
      succeeded: 0,
      failed: 0,
    };
  }

  private emptyExportSummary(): MetricRow {
    return { bucket: '', count: 0, rows: 0, bytes: 0, succeeded: 0, failed: 0 };
  }

  private emptyImportBucket() {
    return { count: 0, rows: 0, failedRows: 0, succeeded: 0, failed: 0 };
  }

  private emptyExportBucket() {
    return { count: 0, rows: 0, bytes: 0, succeeded: 0, failed: 0 };
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

  private range(from?: Date, to?: Date): { from: Date; to: Date } {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - DAY_MS);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    )
      throw new BadRequestException('Invalid observability date range');
    if (end.getTime() - start.getTime() > MAX_DAYS * DAY_MS)
      throw new BadRequestException(
        `Observability range cannot exceed ${MAX_DAYS} days`,
      );
    return { from: start, to: end };
  }
}
