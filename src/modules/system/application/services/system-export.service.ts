import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { Readable } from 'node:stream';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUDIT_ACTIONS } from '../../../../common/audit/audit-events.js';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from '../../domain/repositories/system-activity.repository.js';
import type { SystemArtifactStorage } from '../../domain/repositories/system-artifact.storage.js';
import { SYSTEM_ARTIFACT_STORAGE } from '../../domain/repositories/system-artifact.storage.js';
import type {
  SystemExportJobRecord,
  SystemExportRepository,
} from '../../domain/repositories/system-export.repository.js';
import { SYSTEM_EXPORT_REPOSITORY } from '../../domain/repositories/system-export.repository.js';
import type {
  ExportColumn,
  ExportRequest,
  ExportResult,
} from '../../domain/system-public.contracts.js';
import type { SystemXlsxExporter } from '../../domain/repositories/system-xlsx-exporter.port.js';
import { SYSTEM_XLSX_EXPORTER } from '../../domain/repositories/system-xlsx-exporter.port.js';

const DEFAULT_MAX_ROWS = 10_000;
const PAGE_SIZE = 500;
const ALL_COLUMNS: readonly ExportColumn[] = [
  'uuid',
  'actorUuid',
  'eventType',
  'category',
  'resourceType',
  'resourceUuid',
  'summary',
  'metadata',
  'requestId',
  'createdAt',
];

class ExportCancelledError extends Error {
  constructor() {
    super('Export cancellation requested');
    this.name = 'ExportCancelledError';
  }
}

@Injectable()
export class SystemExportService {
  constructor(
    @Inject(SYSTEM_EXPORT_REPOSITORY)
    private readonly jobs: SystemExportRepository,
    @Inject(SYSTEM_ACTIVITY_REPOSITORY)
    private readonly activity: SystemActivityRepository,
    @Inject(SYSTEM_ARTIFACT_STORAGE)
    private readonly storage: SystemArtifactStorage,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    @Inject(SYSTEM_XLSX_EXPORTER)
    private readonly xlsx: SystemXlsxExporter,
    private readonly config: ConfigService,
  ) {}

  async execute(request: ExportRequest): Promise<ExportResult> {
    const maxRows = this.config.get<number>('system.export.maxRows', DEFAULT_MAX_ROWS);
    const maxConcurrent = this.config.get<number>('system.export.maxConcurrent', 2);
    if ((await this.jobs.countRunning()) >= maxConcurrent) {
      throw new HttpException('Export concurrency limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
    const requestedLimit = Math.min(request.limit ?? maxRows, maxRows);
    if (requestedLimit < 1) throw new ForbiddenException('Export row limit must be positive');

    const estimated = await this.activity.list({
      page: 1,
      limit: 1,
      actorUuid: request.actorUuid,
      eventType: request.eventType,
      category: request.category,
      sort: request.sort ?? 'createdAt_desc',
    });
    const estimatedRows = Math.min(estimated.total, requestedLimit);
    const retentionHours = this.config.get<number>('system.export.retentionHours', 24);
    const expiresAt = new Date(Date.now() + Math.max(1, retentionHours) * 3_600_000);
    const uuid = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const filters: Record<string, unknown> = {
      entity: request.entity,
      format: request.format,
      limit: requestedLimit,
      actorUuid: request.actorUuid,
      ...(request.from ? { from: request.from.toISOString() } : {}),
      ...(request.to ? { to: request.to.toISOString() } : {}),
      ...(request.category ? { category: request.category } : {}),
      ...(request.eventType ? { eventType: request.eventType } : {}),
      sort: request.sort ?? 'createdAt_desc',
      columns: request.columns?.length ? [...request.columns] : [...ALL_COLUMNS],
    };

    const job = await this.jobs.create({
      uuid,
      actorUuid: request.actorUuid,
      entity: request.entity,
      format: request.format,
      filters,
      expiresAt,
      estimatedRows,
      downloadTokenHash: hashToken(token),
    });
    await this.auditLifecycle(request.actorUuid, uuid, 'created', `estimated=${estimatedRows}`);
    return { ...this.publicResult(job), downloadToken: token };
  }

  async processQueued(): Promise<boolean> {
    const job = await this.jobs.claimQueued();
    if (!job) return false;
    await this.processJob(job);
    return true;
  }

  async get(actorUuid: string, uuid: string) {
    const row = await this.jobs.findByUuid(uuid, actorUuid);
    if (!row) throw new NotFoundException('Export job not found');
    return this.publicJob(row);
  }

  async list(actorUuid: string, page = 1, limit = 20, state?: SystemExportJobRecord['state']) {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const result = await this.jobs.list({ actorUuid, page: normalizedPage, limit: normalizedLimit, state });
    return {
      items: result.items.map((row) => this.publicJob(row)),
      total: result.total,
      page: normalizedPage,
      limit: normalizedLimit,
    };
  }

  async retry(actorUuid: string, uuid: string): Promise<ExportResult> {
    const row = await this.jobs.findByUuid(uuid, actorUuid);
    if (!row) throw new NotFoundException('Export job not found');
    if (row.state !== 'FAILED') throw new ForbiddenException('Only failed exports can be retried');
    if ((await this.jobs.countRunning()) >= this.config.get<number>('system.export.maxConcurrent', 2)) {
      throw new HttpException('Export concurrency limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (row.artifactPath) await this.storage.remove(row.artifactPath);
    const token = randomBytes(32).toString('base64url');
    const reset = await this.jobs.update(uuid, {
      state: 'QUEUED',
      artifactPath: null,
      downloadTokenHash: hashToken(token),
      rows: 0,
      processedRows: 0,
      completedAt: null,
      cancelledAt: null,
      cancelRequested: false,
      artifactBytes: null,
      errorMessage: null,
    });
    await this.auditLifecycle(actorUuid, uuid, 'retry', 'retry=true');
    return { ...this.publicResult(reset), downloadToken: token };
  }

  async cancel(actorUuid: string, uuid: string): Promise<ExportResult> {
    const row = await this.jobs.findByUuid(uuid, actorUuid);
    if (!row) throw new NotFoundException('Export job not found');
    if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(row.state)) {
      throw new ForbiddenException('Export job is no longer cancellable');
    }
    const updated = await this.jobs.update(
      uuid,
      row.state === 'QUEUED'
        ? { state: 'CANCELLED', cancelledAt: new Date() }
        : { cancelRequested: true },
    );
    await this.auditLifecycle(actorUuid, uuid, 'cancelled', 'cancelRequested=true');
    return this.publicResult(updated);
  }

  async cleanup(limit = 100) {
    const expired = await this.jobs.listExpired(new Date(), Math.min(500, Math.max(1, limit)));
    for (const row of expired) if (row.artifactPath) await this.storage.remove(row.artifactPath);
    await this.jobs.deleteMany(expired.map((row) => row.uuid));
    return { scanned: expired.length, deleted: expired.length };
  }

  async download(actorUuid: string, uuid: string, token: string) {
    const row = await this.jobs.findByUuid(uuid, actorUuid);
    if (!row || row.state !== 'SUCCEEDED' || !row.artifactPath || !row.downloadTokenHash) {
      throw new NotFoundException('Export artifact not found');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.storage.remove(row.artifactPath);
      throw new ForbiddenException('Export download has expired');
    }
    const provided = Buffer.from(hashToken(token));
    const expected = Buffer.from(row.downloadTokenHash);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new ForbiddenException('Invalid export download token');
    }
    await this.auditLifecycle(actorUuid, uuid, 'downloaded', `rows=${row.rows}`);
    return {
      filename: `${row.uuid}.${row.format}`,
      stream: this.storage.stream(row.artifactPath),
      contentType:
        row.format === 'csv'
          ? 'text/csv; charset=utf-8'
          : row.format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/json; charset=utf-8',
    };
  }

  private async processJob(job: SystemExportJobRecord): Promise<void> {
    await this.jobs.update(job.uuid, { state: 'RUNNING', processedRows: 0 });
    await this.auditLifecycle(job.actorUuid, job.uuid, 'started', `estimated=${job.estimatedRows ?? 0}`);
    try {
      const input =
        job.format === 'xlsx'
          ? Readable.from([await this.xlsxBuffer(job)])
          : Readable.from(job.format === 'json' ? this.jsonStream(job) : this.csvStream(job));
      const stored = await this.storage.putStream(job.uuid, input, job.format);
      const bytes = await this.storage.size(stored.path);
      const maxBytes = this.config.get<number>('system.export.maxArtifactBytes', 25 * 1024 * 1024);
      if (bytes > maxBytes) {
        await this.storage.remove(stored.path);
        throw new Error('Export artifact exceeds configured size limit');
      }
      const processedRows = (await this.jobs.findByUuid(job.uuid))?.processedRows ?? 0;
      await this.jobs.update(job.uuid, {
        state: 'SUCCEEDED',
        artifactPath: stored.path,
        rows: processedRows,
        processedRows,
        completedAt: new Date(),
        artifactBytes: BigInt(bytes),
      });
      await this.auditLifecycle(job.actorUuid, job.uuid, 'completed', `rows=${processedRows};bytes=${bytes}`);
    } catch (error: unknown) {
      const processedRows = (await this.jobs.findByUuid(job.uuid))?.processedRows ?? 0;
      if (error instanceof ExportCancelledError) {
        await this.jobs.update(job.uuid, {
          state: 'CANCELLED',
          cancelledAt: new Date(),
          processedRows,
          errorMessage: null,
        });
        await this.auditLifecycle(job.actorUuid, job.uuid, 'cancelled', `processed=${processedRows}`);
        return;
      }
      await this.jobs.update(job.uuid, {
        state: 'FAILED',
        processedRows,
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Export failed',
      });
      await this.auditLifecycle(job.actorUuid, job.uuid, 'failed', 'failure=true');
    }
  }

  private selectedColumns(job: SystemExportJobRecord): readonly ExportColumn[] {
    const raw = job.filters.columns;
    if (!Array.isArray(raw)) return ALL_COLUMNS;
    const selected = raw.filter(
      (value): value is ExportColumn =>
        typeof value === 'string' && (ALL_COLUMNS as readonly string[]).includes(value),
    );
    return selected.length ? [...new Set(selected)] : ALL_COLUMNS;
  }

  private async xlsxBuffer(job: SystemExportJobRecord): Promise<Buffer> {
    const headers = this.selectedColumns(job);
    const rows: unknown[][] = [];
    let emitted = 0;
    let page = 1;
    const limit = Number(job.filters.limit ?? DEFAULT_MAX_ROWS);
    while (emitted < limit) {
      await this.throwIfCancelled(job.uuid);
      const result = await this.readActivityBatch(job, page++);
      if (!result.items.length) break;
      for (const row of result.items) {
        await this.throwIfCancelled(job.uuid);
        const output = this.exportRow(row);
        rows.push(headers.map((header) => output[header]));
        emitted += 1;
        await this.jobs.update(job.uuid, { processedRows: emitted });
        if (emitted >= limit) break;
      }
      if (page > 1 + Math.ceil(result.total / PAGE_SIZE) || emitted >= limit) break;
    }
    return this.xlsx.build(headers, rows);
  }

  private async *jsonStream(job: SystemExportJobRecord) {
    yield '[';
    const columns = this.selectedColumns(job);
    let emitted = 0;
    let page = 1;
    const limit = Number(job.filters.limit ?? DEFAULT_MAX_ROWS);
    while (emitted < limit) {
      await this.throwIfCancelled(job.uuid);
      const result = await this.readActivityBatch(job, page++);
      if (!result.items.length) break;
      for (const row of result.items) {
        await this.throwIfCancelled(job.uuid);
        const output = this.exportRow(row);
        const selected = Object.fromEntries(columns.map((key) => [key, output[key]]));
        if (emitted > 0) yield ',';
        yield JSON.stringify(selected);
        emitted += 1;
        await this.jobs.update(job.uuid, { processedRows: emitted });
        if (emitted >= limit) break;
      }
      if (emitted >= limit || result.items.length < PAGE_SIZE) break;
    }
    yield ']';
  }

  private async *csvStream(job: SystemExportJobRecord) {
    const headers = this.selectedColumns(job);
    yield `${headers.join(',')}\n`;
    let emitted = 0;
    let page = 1;
    const limit = Number(job.filters.limit ?? DEFAULT_MAX_ROWS);
    while (emitted < limit) {
      await this.throwIfCancelled(job.uuid);
      const result = await this.readActivityBatch(job, page++);
      if (!result.items.length) break;
      for (const row of result.items) {
        await this.throwIfCancelled(job.uuid);
        const output = this.exportRow(row);
        const values = headers.map((header) => csvCell(stringifyExportValue(output[header])));
        yield `${values.join(',')}\n`;
        emitted += 1;
        await this.jobs.update(job.uuid, { processedRows: emitted });
        if (emitted >= limit) break;
      }
      if (emitted >= limit || result.items.length < PAGE_SIZE) break;
    }
  }

  private async readActivityBatch(job: SystemExportJobRecord, page: number) {
    const filters = job.filters;
    return this.activity.list({
      page,
      limit: PAGE_SIZE,
      actorUuid: asString(filters.actorUuid),
      eventType: asString(filters.eventType),
      category: asString(filters.category),
      sort: filters.sort === 'createdAt_asc' ? 'createdAt_asc' : 'createdAt_desc',
    });
  }

  private async throwIfCancelled(uuid: string) {
    const row = await this.jobs.findByUuid(uuid);
    if (row?.cancelRequested) throw new ExportCancelledError();
  }

  private exportRow(row: {
    uuid: string;
    actorUuid: string | null;
    eventType: string;
    category: string;
    resourceType: string | null;
    resourceUuid: string | null;
    summary: string;
    metadata: Record<string, unknown>;
    requestId: string | null;
    createdAt: Date;
  }): Record<ExportColumn, unknown> {
    return {
      uuid: row.uuid,
      actorUuid: row.actorUuid,
      eventType: row.eventType,
      category: row.category,
      resourceType: row.resourceType,
      resourceUuid: row.resourceUuid,
      summary: row.summary,
      metadata: row.metadata,
      requestId: row.requestId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private publicJob(row: SystemExportJobRecord) {
    return {
      uuid: row.uuid,
      actorUuid: row.actorUuid,
      entity: row.entity,
      format: row.format,
      state: row.state,
      rows: row.rows,
      processedRows: row.processedRows,
      estimatedRows: row.estimatedRows,
      artifactBytes: row.artifactBytes?.toString() ?? null,
      errorMessage: row.errorMessage,
      expiresAt: row.expiresAt,
      completedAt: row.completedAt,
      cancelledAt: row.cancelledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private publicResult(row: SystemExportJobRecord): ExportResult {
    return {
      uuid: row.uuid,
      state: row.state,
      format: row.format,
      rows: row.rows,
      processedRows: row.processedRows,
      estimatedRows: row.estimatedRows,
      expiresAt: row.expiresAt,
    };
  }

  private async auditLifecycle(
    actorUuid: string,
    resourceUuid: string,
    action: 'created' | 'started' | 'completed' | 'failed' | 'retry' | 'cancelled' | 'downloaded',
    summary: string,
  ) {
    const event =
      action === 'created'
        ? AUDIT_ACTIONS.SYSTEM_EXPORT_CREATED
        : action === 'started'
          ? AUDIT_ACTIONS.SYSTEM_EXPORT_STARTED
          : action === 'completed'
            ? AUDIT_ACTIONS.SYSTEM_EXPORT_COMPLETED
            : action === 'failed'
              ? AUDIT_ACTIONS.SYSTEM_EXPORT_FAILED
              : action === 'retry'
                ? AUDIT_ACTIONS.SYSTEM_EXPORT_RETRIED
                : action === 'cancelled'
                  ? AUDIT_ACTIONS.SYSTEM_EXPORT_CANCELLED
                  : AUDIT_ACTIONS.SYSTEM_EXPORT_DOWNLOADED;
    await this.audit.record({
      actorUuid,
      action: event,
      resourceType: 'system_export',
      resourceId: resourceUuid,
      reason: summary,
      system: false,
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringifyExportValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value) ?? '';
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
