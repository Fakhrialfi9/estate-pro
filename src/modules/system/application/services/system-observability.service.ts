import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';

const MAX_DAYS = 90;

@Injectable()
export class SystemObservabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async importExportMetrics(from?: Date, to?: Date) {
    const range = this.range(from, to);
    const [imports, exports] = await Promise.all([
      this.prisma.systemImportJob.findMany({
        where: { createdAt: { gte: range.from, lt: range.to } },
        select: {
          createdAt: true,
          state: true,
          totalRows: true,
          processedRows: true,
          failedRows: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.systemExportJob.findMany({
        where: { createdAt: { gte: range.from, lt: range.to } },
        select: {
          createdAt: true,
          state: true,
          rows: true,
          processedRows: true,
          artifactBytes: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const byDay = new Map<string, {
      imports: { count: number; rows: number; failedRows: number; succeeded: number; failed: number };
      exports: { count: number; rows: number; bytes: number; succeeded: number; failed: number };
    }>();
    const bucket = (date: Date) => date.toISOString().slice(0, 10);
    for (const job of imports) {
      const key = bucket(job.createdAt);
      const entry = byDay.get(key) ?? {
        imports: { count: 0, rows: 0, failedRows: 0, succeeded: 0, failed: 0 },
        exports: { count: 0, rows: 0, bytes: 0, succeeded: 0, failed: 0 },
      };
      entry.imports.count += 1;
      entry.imports.rows += job.processedRows || job.totalRows;
      entry.imports.failedRows += job.failedRows;
      if (job.state === 'SUCCEEDED') entry.imports.succeeded += 1;
      if (job.state === 'FAILED') entry.imports.failed += 1;
      byDay.set(key, entry);
    }
    for (const job of exports) {
      const key = bucket(job.createdAt);
      const entry = byDay.get(key) ?? {
        imports: { count: 0, rows: 0, failedRows: 0, succeeded: 0, failed: 0 },
        exports: { count: 0, rows: 0, bytes: 0, succeeded: 0, failed: 0 },
      };
      entry.exports.count += 1;
      entry.exports.rows += job.processedRows || job.rows;
      entry.exports.bytes += Number(job.artifactBytes ?? 0n);
      if (job.state === 'SUCCEEDED') entry.exports.succeeded += 1;
      if (job.state === 'FAILED') entry.exports.failed += 1;
      byDay.set(key, entry);
    }

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      summary: {
        imports: this.summarizeImports(imports),
        exports: this.summarizeExports(exports),
      },
      series: [...byDay.entries()].map(([date, value]) => ({ date, ...value })),
    };
  }

  async deliveryMetrics(from?: Date, to?: Date, subscriptionUuid?: string) {
    const range = this.range(from, to);
    const where = {
      createdAt: { gte: range.from, lt: range.to },
      ...(subscriptionUuid ? { subscription: { uuid: subscriptionUuid } } : {}),
    };
    const rows = await this.prisma.systemWebhookDelivery.findMany({
      where,
      select: {
        state: true,
        attemptCount: true,
        createdAt: true,
        completedAt: true,
        httpStatus: true,
      },
    });
    let totalLatency = 0;
    let latencyCount = 0;
    const states: Record<string, number> = {};
    let retries = 0;
    let httpFailures = 0;
    for (const row of rows) {
      states[row.state] = (states[row.state] ?? 0) + 1;
      if (row.attemptCount > 1) retries += 1;
      if (row.httpStatus != null && row.httpStatus >= 400) httpFailures += 1;
      if (row.completedAt) {
        totalLatency += Math.max(0, row.completedAt.getTime() - row.createdAt.getTime());
        latencyCount += 1;
      }
    }
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      subscriptionUuid: subscriptionUuid ?? null,
      total: rows.length,
      states,
      retries,
      httpFailures,
      averageLatencyMs: latencyCount ? Math.round(totalLatency / latencyCount) : 0,
    };
  }

  private summarizeImports(rows: readonly { state: string; processedRows: number; totalRows: number; failedRows: number }[]) {
    return {
      count: rows.length,
      succeeded: rows.filter((row) => row.state === 'SUCCEEDED').length,
      failed: rows.filter((row) => row.state === 'FAILED').length,
      processedRows: rows.reduce((sum, row) => sum + (row.processedRows || row.totalRows), 0),
      failedRows: rows.reduce((sum, row) => sum + row.failedRows, 0),
    };
  }

  private summarizeExports(rows: readonly { state: string; rows: number; processedRows: number; artifactBytes: bigint | null }[]) {
    return {
      count: rows.length,
      succeeded: rows.filter((row) => row.state === 'SUCCEEDED').length,
      failed: rows.filter((row) => row.state === 'FAILED').length,
      processedRows: rows.reduce((sum, row) => sum + (row.processedRows || row.rows), 0),
      artifactBytes: rows.reduce((sum, row) => sum + Number(row.artifactBytes ?? 0n), 0),
    };
  }

  private range(from?: Date, to?: Date): { from: Date; to: Date } {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 24 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end)
      throw new BadRequestException('Invalid observability date range');
    if (end.getTime() - start.getTime() > MAX_DAYS * 24 * 60 * 60 * 1000)
      throw new BadRequestException(`Observability range cannot exceed ${MAX_DAYS} days`);
    return { from: start, to: end };
  }
}
