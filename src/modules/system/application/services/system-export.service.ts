import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from '../../domain/repositories/system-activity.repository.js';
import type { SystemArtifactStorage } from '../../domain/repositories/system-artifact.storage.js';
import { SYSTEM_ARTIFACT_STORAGE } from '../../domain/repositories/system-artifact.storage.js';
import type { SystemExportJobRecord, SystemExportRepository } from '../../domain/repositories/system-export.repository.js';
import { SYSTEM_EXPORT_REPOSITORY } from '../../domain/repositories/system-export.repository.js';
import type { ExportRequest, ExportResult } from '../../domain/system-public.contracts.js';

const MAX_ROWS = 10_000;
const EXPIRY_MS = 15 * 60 * 1000;

const csvCell = (value: unknown): string => {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

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
  ) {}

  async execute(request: ExportRequest): Promise<ExportResult> {
    const uuid = randomUUID();
    const expiresAt = new Date(Date.now() + EXPIRY_MS);
    await this.jobs.create({
      uuid,
      actorUuid: request.actorUuid,
      entity: request.entity,
      format: request.format,
      filters: {
        from: request.from?.toISOString(),
        to: request.to?.toISOString(),
        category: request.category,
        eventType: request.eventType,
      },
      expiresAt,
    });
    const downloadToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256')
      .update(downloadToken, 'utf8')
      .digest('hex');

    await this.audit.record({
      action: 'SYSTEM_EXPORT_CREATED',
      actorUuid: request.actorUuid,
      subjectUuid: request.actorUuid,
      entityType: 'system_export',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: `entity=${request.entity};format=${request.format}`,
    });

    try {
      await this.jobs.update(uuid, {
        state: 'RUNNING',
        downloadTokenHash: tokenHash,
      });
      const result = await this.activity.list({
        page: 1,
        limit: MAX_ROWS,
        category: request.category,
        eventType: request.eventType,
      });
      const rows = result.items
        .filter(
          (row) =>
            (!request.from || row.createdAt >= request.from) &&
            (!request.to || row.createdAt <= request.to),
        )
        .slice(0, Math.min(request.limit ?? MAX_ROWS, MAX_ROWS))
        .map((row) => ({
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
        }));

      const artifactStream =
        request.format === 'json'
          ? Readable.from(this.jsonChunks(rows))
          : Readable.from(this.csvChunks(rows));
      const stored = await this.storage.putStream(
        uuid,
        artifactStream,
        request.format,
      );
      const updated = await this.jobs.update(uuid, {
        state: 'SUCCEEDED',
        artifactPath: stored.path,
        rows: rows.length,
        expiresAt,
      });
      await this.audit.record({
        action: 'SYSTEM_EXPORT_COMMITTED',
        actorUuid: request.actorUuid,
        subjectUuid: request.actorUuid,
        entityType: 'system_export',
        entityUuid: uuid,
        result: 'SUCCESS',
        reason: `rows=${rows.length}`,
      });
      return {
        uuid: updated.uuid,
        state: 'SUCCEEDED',
        format: updated.format,
        rows: updated.rows,
        expiresAt: updated.expiresAt,
        downloadToken,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Export failed';
      const updated = await this.jobs.update(uuid, {
        state: 'FAILED',
        errorMessage: message,
      });
      await this.audit.record({
        action: 'SYSTEM_EXPORT_FAILED',
        actorUuid: request.actorUuid,
        subjectUuid: request.actorUuid,
        entityType: 'system_export',
        entityUuid: uuid,
        result: 'FAILURE',
        reason: message,
      });
      return {
        uuid: updated.uuid,
        state: 'FAILED',
        format: updated.format,
        rows: updated.rows,
        expiresAt: updated.expiresAt,
        downloadToken,
      };
    }
  }

  async get(actorUuid: string, uuid: string) {
    const row = await this.jobs.findByUuid(uuid, actorUuid);
    if (!row) throw new NotFoundException('Export job not found');
    return {
      uuid: row.uuid,
      actorUuid: row.actorUuid,
      entity: row.entity,
      format: row.format,
      state: row.state,
      filters: row.filters,
      rows: row.rows,
      expiresAt: row.expiresAt,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(
    actorUuid: string,
    page = 1,
    limit = 20,
    state?: SystemExportJobRecord['state'],
  ) {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const result = await this.jobs.list({
      actorUuid,
      page: normalizedPage,
      limit: normalizedLimit,
      state,
    });
    return {
      items: result.items.map((row) => ({
        uuid: row.uuid,
        actorUuid: row.actorUuid,
        entity: row.entity,
        format: row.format,
        state: row.state,
        filters: row.filters,
        rows: row.rows,
        expiresAt: row.expiresAt,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total: result.total,
      page: normalizedPage,
      limit: normalizedLimit,
    };
  }

  async download(
    actorUuid: string,
    uuid: string,
    token: string,
  ): Promise<{
    filename: string;
    stream: Readable;
    contentType: string;
  }> {
    const row = await this.jobs.findByUuid(uuid, actorUuid);
    if (
      !row ||
      row.state !== 'SUCCEEDED' ||
      !row.artifactPath ||
      !row.downloadTokenHash
    ) {
      throw new NotFoundException('Export artifact not found');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.storage.remove(row.artifactPath);
      throw new ForbiddenException('Export download has expired');
    }
    const hash = Buffer.from(
      createHash('sha256').update(token ?? '', 'utf8').digest('hex'),
    );
    const expected = Buffer.from(row.downloadTokenHash);
    if (
      hash.length !== expected.length ||
      !timingSafeEqual(hash, expected)
    ) {
      throw new ForbiddenException('Invalid export download token');
    }
    return {
      filename: `${row.uuid}.${row.format}`,
      stream: this.storage.stream(row.artifactPath),
      contentType:
        row.format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/json; charset=utf-8',
    };
  }

  private *jsonChunks(rows: readonly Record<string, unknown>[]) {
    yield '[';
    for (let index = 0; index < rows.length; index += 1) {
      if (index > 0) yield ',';
      yield JSON.stringify(rows[index]);
    }
    yield ']';
  }

  private *csvChunks(rows: readonly Record<string, unknown>[]) {
    const headers = [
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
    yield `${headers.join(',')}\n`;
    for (const row of rows) {
      yield `${headers
        .map((key) =>
          csvCell(
            key === 'metadata'
              ? JSON.stringify(row[key] ?? {})
              : row[key],
          ),
        )
        .join(',')}\n`;
    }
  }
}
