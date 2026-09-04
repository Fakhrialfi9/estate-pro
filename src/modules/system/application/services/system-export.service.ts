import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { Readable } from 'node:stream';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  TooManyRequestsException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  ExportRequest,
  ExportResult,
} from '../../domain/system-public.contracts.js';

const DEFAULT_MAX_ROWS = 10_000;
const DEFAULT_EXPIRY_MS = 15 * 60 * 1000;
const PAGE_SIZE = 500;
const BATCH_PROGRESS_INTERVAL = 10;
const AUDIT_ACTION = 'SYSTEM_SETTING_UPDATED';

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
    private readonly config: ConfigService,
  ) {}

  async execute(request: ExportRequest): Promise<ExportResult> {
    const maxRows = this.config.get<number>('system.export.maxRows', DEFAULT_MAX_ROWS);
    const maxConcurrent = this.config.get<number>('system.export.maxConcurrent', 2);
    const running = await this.jobs.countRunning();
    if (running >= maxConcurrent) {
      throw new TooManyRequestsException('Export concurrency limit reached');
    }
    const requestedLimit = Math.min(request.limit ?? maxRows, maxRows);
    if (requestedLimit < 1) throw new ForbiddenException('Export row limit must be positive');

    const estimated = await this.activity.list({
      page: 1,
      limit: 1,
      actorUuid: request.actorUuid,
      eventType: request.eventType,
      category: request.category,
    });
    const estimatedRows = Math.min(estimated.total, requestedLimit);
    const retentionHours = this.config.get<number>('system.export.retentionHours', 24);
    const expiresAt = new Date(Date.now() + Math.max(1, retentionHours) * 60 * 60 * 1000);
    const uuid = randomUUID();
    const snapshot = {
      entity: request.entity,
      format: request.format,
      limit: requestedLimit,
      actorUuid: request.actorUuid,
      from: request.from?.toISOString(),
      to: request.to?.toISOString(),
      category: request.category,
      eventType: request.eventType,
    };
    const job = await this.jobs.create({
      uuid,
      actorUuid: request.actorUuid,
      entity: request.entity,
      format: request.format,
      filters: snapshot,
      expiresAt,
      estimatedRows,
    });
    await this.auditLifecycle(request.actorUuid, uuid, 'export.created', `estimated=${estimatedRows}`);
    return this.processJob(job, randomBytes(32).toString('base64url'));
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
    if (await this.jobs.countRunning() >= this.config.get<number>('system.export.maxConcurrent', 2)) {
      throw new TooManyRequestsException('Export concurrency limit reached');
    }
    if (row.artifactPath) await this.storage.remove(row.artifactPath);
    const token = randomBytes(32).toString('base64url');
    const reset = await this.jobs.update(uuid, {
      state: 'QUEUED',
      artifactPath: null,
      downloadTokenHash: null,
      rows: 0,
      processedRows: 0,
      completedAt: null,
      cancelledAt: null,
      cancelRequested: false,
      artifactBytes: null,
      errorMessage: null,
    });
    await this.auditLifecycle(actorUuid, uuid, 'export.retry', 'retry=true');
    return this.processJob(reset, token);
  }

  async cancel(actorUuid: string, uuid: string): Promise<ExportResult> {
    const row = await this.jobs.findByUuid(uuid, actorUuid);
    if (!row) throw new NotFoundException('Export job not found');
    if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(row.state)) {
      throw new ForbiddenException('Export job is no longer cancellable');
    }
    const updated = await this.jobs.update(uuid, {
      ...(row.state === 'QUEUED' ? { state: 'CANCELLED', cancelledAt: new Date() } : { cancelRequested: true }),
    });
    await this.auditLifecycle(actorUuid, uuid, 'export.cancel', 'cancelRequested=true');
    return this.publicResult(updated);
  }

  async cleanup(limit = 100) {
    const expired = await this.jobs.listExpired(new Date(), Math.min(500, Math.max(1, limit)));
    const removable = [] as string[];
    for (const row of expired) {
      if (row.artifactPath) await this.storage.remove(row.artifactPath);
      removable.push(row.uuid);
    }
    await this.jobs.deleteMany(removable);
    return { scanned: expired.length, deleted: removable.length };
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
    const hash = Buffer.from(createHash('sha256').update(token ?? '', 'utf8').digest('hex'));
    const expected = Buffer.from(row.downloadTokenHash);
    if (hash.length !== expected.length || !timingSafeEqual(hash, expected)) {
      throw new ForbiddenException('Invalid export download token');
    }
    await this.auditLifecycle(actorUuid, uuid, 'export.download', `rows=${row.rows}`);
    return {
      filename: `${row.uuid}.${row.format}`,
      stream: this.storage.stream(row.artifactPath),
      contentType: row.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    };
  }

  private async processJob(job: SystemExportJobRecord, downloadToken: string): Promise<ExportResult> {
    const tokenHash = createHash('sha256').update(downloadToken, 'utf8').digest('hex');
    await this.jobs.update(job.uuid, { state: 'RUNNING', downloadTokenHash: tokenHash, processedRows: 0 });
    await this.auditLifecycle(job.actorUuid, job.uuid, 'export.started', `estimated=${job.estimatedRows ?? 0}`);

    let processedRows = 0;
    try {
      const generator = job.format === 'json'
        ? this.jsonStream(job, processedRows)
        : this.csvStream(job, processedRows);
      const stored = await this.storage.putStream(job.uuid, Readable.from(generator), job.format);
      const bytes = await this.storage.size(stored.path);
      const maxBytes = this.config.get<number>('system.export.maxArtifactBytes', 25 * 1024 * 1024);
      if (bytes > maxBytes) {
        await this.storage.remove(stored.path);
        throw new Error('Export artifact exceeds configured size limit');
      }
      const final = await this.jobs.update(job.uuid, {
        state: 'SUCCEEDED',
        artifactPath: stored.path,
        rows: processedRows,
        processedRows,
        completedAt: new Date(),
        artifactBytes: BigInt(bytes),
      });
      await this.auditLifecycle(job.actorUuid, job.uuid, 'export.completed', `rows=${processedRows};bytes=${bytes}`);
      return {
        uuid: final.uuid,
        state: 'SUCCEEDED',
        format: final.format,
        rows: final.rows,
        processedRows: final.processedRows,
        estimatedRows: final.estimatedRows,
        expiresAt: final.expiresAt,
        downloadToken,
      };
    } catch (error: unknown) {
      if (error instanceof ExportCancelledError) {
        const cancelled = await this.jobs.update(job.uuid, {
          state: 'CANCELLED',
          cancelledAt: new Date(),
          processedRows,
          errorMessage: null,
        });
        await this.auditLifecycle(job.actorUuid, job.uuid, 'export.cancelled', `processed=${processedRows}`);
        return this.publicResult(cancelled);
      }
      const message = error instanceof Error ? error.message : 'Export failed';
      const failed = await this.jobs.update(job.uuid, {
        state: 'FAILED',
        processedRows,
        errorMessage: message.slice(0, 500),
      });
      await this.auditLifecycle(job.actorUuid, job.uuid, 'export.failed', 'failure=true');
      return {
        uuid: failed.uuid,
        state: 'FAILED',
        format: failed.format,
        rows: failed.rows,
        processedRows: failed.processedRows,
        estimatedRows: failed.estimatedRows,
        expiresAt: failed.expiresAt,
        downloadToken,
      };
    }
  }

  private async *jsonStream(job: SystemExportJobRecord, counter: number) {
    yield '[';
    let emitted = 0;
    let page = 1;
    while (emitted < Number(job.filters.limit ?? DEFAULT_MAX_ROWS)) {
      await this.throwIfCancelled(job.uuid);
      const batch = await this.readActivityBatch(job, page++);
      if (batch.length === 0) break;
      for (const row of batch) {
        await this.throwIfCancelled(job.uuid);
        if (emitted > 0) yield ',';
        yield JSON.stringify(this.exportRow(row));
        emitted += 1;
        counter = emitted;
      }
      if (batch.length < PAGE_SIZE) break;
      await this.jobs.update(job.uuid, { processedRows: emitted });
    }
    await this.jobs.update(job.uuid, { processedRows: emitted });
    yield ']';
  }

  private async *csvStream(job: SystemExportJobRecord, counter: number) {
    const headers = ['uuid', 'actorUuid', 'eventType', 'category', 'resourceType', 'resourceUuid', 'summary', 'metadata', 'requestId', 'createdAt'];
    yield `${headers.join(',')}\n`;
    let emitted = 0;
    let page = 1;
    while (emitted < Number(job.filters.limit ?? DEFAULT_MAX_ROWS)) {
      await this.throwIfCancelled(job.uuid);
      const batch = await this.readActivityBatch(job, page++);
      if (batch.length === 0) break;
      for (const row of batch) {
        await this.throwIfCancelled(job.uuid);
        const output = this.exportRow(row);
        yield `${headers.map((key) => csvCell(key === 'metadata' ? JSON.stringify(output[key] ?? {}) : output[key])).join(',')}\n`;
        emitted += 1;
        counter = emitted;
      }
      if (batch.length < PAGE_SIZE) break;
      await this.jobs.update(job.uuid, { processedRows: emitted });
    }
    await this.jobs.update(job.uuid, { processedRows: emitted });
  }

  private async readActivityBatch(job: SystemExportJobRecord, page: number) {
    const filters = job.filters;
    const result = await this.activity.list({
      page,
      limit: PAGE_SIZE,
      actorUuid: job.actorUuid,
      eventType: typeof filters.eventType === 'string' ? filters.eventType : undefined,
      category: typeof filters.category === 'string' ? filters.category : undefined,
    });
    const from = typeof filters.from === 'string' ? new Date(filters.from) : undefined;
    const to = typeof filters.to === 'string' ? new Date(filters.to) : undefined;
    return result.items
      .filter((row) => (!from || row.createdAt >= from) && (!to || row.createdAt <= to))
      .slice(0, Number(filters.limit ?? DEFAULT_MAX_ROWS));
  }

  private async throwIfCancelled(uuid: string): Promise<void> {
    const current = await this.jobs.findByUuid(uuid);
    if (current?.cancelRequested) throw new ExportCancelledError();
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
  }) {
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
      filters: row.filters,
      rows: row.rows,
      processedRows: row.processedRows,
      estimatedRows: row.estimatedRows,
      expiresAt: row.expiresAt,
      errorMessage: row.errorMessage,
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

  private async auditLifecycle(actorUuid: string, uuid: string, operation: string, reason: string) {
    await this.audit.record({
      action: AUDIT_ACTION,
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_setting',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: `export.${operation};${reason}`,
    });
  }
}

const csvCell = (value: unknown): string => {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
