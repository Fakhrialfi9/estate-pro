import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from '../../domain/repositories/system-activity.repository.js';
import type { SystemArtifactStorage } from '../../domain/repositories/system-artifact.storage.js';
import { SYSTEM_ARTIFACT_STORAGE } from '../../domain/repositories/system-artifact.storage.js';
import type {
  SystemImportJobRecord,
  SystemImportRepository,
} from '../../domain/repositories/system-import.repository.js';
import { SYSTEM_IMPORT_REPOSITORY } from '../../domain/repositories/system-import.repository.js';
import type {
  ImportFormat,
  ImportRequest,
  ImportResult,
} from '../../domain/system-public.contracts.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_ERRORS = 500;
const EXPIRY_MS = 24 * 60 * 60 * 1000;

const sanitizeFilename = (value: string): string =>
  Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || character === '/' || character === '\\'
        ? '_'
        : character;
    })
    .join('');

const readRequiredString = (
  row: Record<string, unknown>,
  key: string,
): string => {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : '';
};

const readNullableString = (
  row: Record<string, unknown>,
  key: string,
): string | null => {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.endsWith('\r') ? cell.slice(0, -1) : cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (quoted) throw new BadRequestException('Malformed CSV quoting');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

const parseRows = (
  content: string,
  format: ImportFormat,
): Record<string, unknown>[] => {
  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadRequestException('Invalid JSON import payload');
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException(
        'JSON import must contain an array of objects',
      );
    }
    return parsed.map((value, index) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new BadRequestException(`Invalid row ${index + 1}`);
      }
      return value as Record<string, unknown>;
    });
  }

  const rows = parseCsv(content);
  if (rows.length === 0) return [];
  const firstRow = rows[0];
  if (!firstRow) return [];
  const headers = firstRow.map((value) => value.trim());
  if (
    headers.some((value) => !value) ||
    new Set(headers).size !== headers.length
  ) {
    throw new BadRequestException('CSV headers must be non-empty and unique');
  }
  return rows.slice(1).map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    ),
  );
};

@Injectable()
export class SystemImportService {
  constructor(
    @Inject(SYSTEM_IMPORT_REPOSITORY)
    private readonly jobs: SystemImportRepository,
    @Inject(SYSTEM_ACTIVITY_REPOSITORY)
    private readonly activity: SystemActivityRepository,
    @Inject(SYSTEM_ARTIFACT_STORAGE)
    private readonly storage: SystemArtifactStorage,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async execute(actorUuid: string, input: ImportRequest): Promise<ImportResult> {
    if (!actorUuid) throw new BadRequestException('Authenticated actor missing');

    const extension = input.filename?.toLowerCase().split('.').pop();
    const format =
      input.format ??
      (extension === 'json' ? 'json' : extension === 'csv' ? 'csv' : undefined);
    if (!input.filename || input.filename.length > 255 || !format) {
      throw new BadRequestException('Only CSV and JSON imports are supported');
    }

    const buffer = Buffer.from(input.contentBase64 ?? '', 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('Import content is required');
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new BadRequestException('Import file exceeds 5 MiB limit');
    }

    const content = buffer.toString('utf8');
    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      createHash('sha256')
        .update(`${actorUuid}:${input.filename}:${content}`)
        .digest('hex');
    const existing = await this.jobs.findByIdempotencyKey(
      idempotencyKey,
      actorUuid,
    );
    if (existing) return this.toResult(existing);

    const job = await this.jobs.create({
      uuid: randomUUID(),
      actorUuid,
      filename: sanitizeFilename(input.filename),
      format,
      preview: input.preview === true,
      idempotencyKey,
      sourcePath: null,
      expiresAt: new Date(Date.now() + EXPIRY_MS),
    });

    await this.audit.record({
      action: 'SYSTEM_IMPORT_CREATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_import',
      entityUuid: job.uuid,
      result: 'SUCCESS',
      reason: `format=${format};preview=${input.preview === true}`,
    });

    try {
      const stored = await this.storage.put(job.uuid, buffer, 'source');
      await this.jobs.update(job.uuid, {
        state: 'RUNNING',
        sourcePath: stored.path,
      });
      await this.audit.record({
        action: 'SYSTEM_IMPORT_STARTED',
        actorUuid,
        subjectUuid: actorUuid,
        entityType: 'system_import',
        entityUuid: job.uuid,
        result: 'SUCCESS',
      });

      const rows = parseRows(content, format);
      if (rows.length > MAX_ROWS) {
        throw new BadRequestException(
          `Import contains more than ${MAX_ROWS} rows`,
        );
      }

      const errors: { row: number; field?: string; message: string }[] = [];
      let processed = 0;
      let failed = 0;
      let cancelled = false;

      for (let index = 0; index < rows.length; index += 1) {
        const current = await this.jobs.findByUuid(job.uuid);
        if (current?.state === 'CANCELLED') {
          cancelled = true;
          break;
        }

        const row = rows[index];
        const rowNumber = index + 2;
        if (!row) {
          failed += 1;
          if (errors.length < MAX_ERRORS) {
            errors.push({ row: rowNumber, message: 'Invalid row' });
          }
          continue;
        }

        const eventType = readRequiredString(row, 'eventType');
        const category = readRequiredString(row, 'category');
        const summary = readRequiredString(row, 'summary');
        if (!eventType || !category || !summary) {
          failed += 1;
          if (errors.length < MAX_ERRORS) {
            errors.push({
              row: rowNumber,
              message: 'eventType, category and summary are required',
            });
          }
          continue;
        }
        if (input.preview) {
          processed += 1;
          continue;
        }

        const deterministicUuid = createHash('sha256')
          .update(`${idempotencyKey}:${index}:${JSON.stringify(row)}`)
          .digest('hex')
          .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5');
        const data = {
          uuid: deterministicUuid,
          actorUuid,
          eventType,
          category,
          resourceType: readNullableString(row, 'resourceType'),
          resourceUuid: readNullableString(row, 'resourceUuid'),
          summary,
          metadata:
            typeof row.metadata === 'object' && row.metadata !== null
              ? (row.metadata as Record<string, unknown>)
              : {},
          requestId: readNullableString(row, 'requestId'),
        };

        try {
          await this.activity.append(data);
          processed += 1;
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            /unique|duplicate/i.test(error.message)
          ) {
            processed += 1;
            continue;
          }
          failed += 1;
          if (errors.length < MAX_ERRORS) {
            errors.push({
              row: rowNumber,
              message:
                error instanceof Error ? error.message : 'Row import failed',
            });
          }
        }
      }

      const finalState = cancelled
        ? 'CANCELLED'
        : failed > 0
          ? 'FAILED'
          : 'SUCCEEDED';
      const updated = await this.jobs.update(job.uuid, {
        state: finalState,
        processedRows: processed,
        failedRows: failed,
        errors,
        totalRows: rows.length,
      });
      await this.audit.record({
        action:
          updated.state === 'SUCCEEDED'
            ? 'SYSTEM_IMPORT_COMMITTED'
            : updated.state === 'CANCELLED'
              ? 'SYSTEM_IMPORT_CANCELLED'
              : 'SYSTEM_IMPORT_FAILED',
        actorUuid,
        subjectUuid: actorUuid,
        entityType: 'system_import',
        entityUuid: job.uuid,
        result: updated.state === 'SUCCEEDED' ? 'SUCCESS' : 'FAILURE',
        reason: `processed=${processed};failed=${failed}`,
      });
      return this.toResult(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import failed';
      const updated = await this.jobs.update(job.uuid, {
        state: 'FAILED',
        errors: [{ row: 0, message }],
      });
      await this.audit.record({
        action: 'SYSTEM_IMPORT_FAILED',
        actorUuid,
        subjectUuid: actorUuid,
        entityType: 'system_import',
        entityUuid: job.uuid,
        result: 'FAILURE',
        reason: message,
      });
      throw error;
    }
  }

  async get(uuid: string, actorUuid: string): Promise<ImportResult> {
    const job = await this.jobs.findByUuid(uuid);
    if (!job || job.actorUuid !== actorUuid) {
      throw new NotFoundException('Import job not found');
    }
    return this.toResult(job);
  }

  async cancel(uuid: string, actorUuid: string): Promise<ImportResult> {
    const job = await this.jobs.findByUuid(uuid);
    if (!job || job.actorUuid !== actorUuid) {
      throw new NotFoundException('Import job not found');
    }
    if (job.state === 'SUCCEEDED' || job.state === 'FAILED') {
      return this.toResult(job);
    }
    const updated = await this.jobs.update(uuid, { state: 'CANCELLED' });
    await this.audit.record({
      action: 'SYSTEM_IMPORT_CANCELLED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_import',
      entityUuid: uuid,
      result: 'SUCCESS',
    });
    return this.toResult(updated);
  }

  async retry(uuid: string, actorUuid: string): Promise<ImportResult> {
    const job = await this.jobs.findByUuid(uuid);
    if (!job || job.actorUuid !== actorUuid) {
      throw new NotFoundException('Import job not found');
    }
    if (job.state !== 'FAILED' && job.state !== 'CANCELLED') {
      return this.toResult(job);
    }
    const updated = await this.jobs.update(uuid, {
      state: 'RETRYABLE',
      errors: [],
    });
    await this.audit.record({
      action: 'SYSTEM_IMPORT_RETRIED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_import',
      entityUuid: uuid,
      result: 'SUCCESS',
    });
    return this.toResult(updated);
  }

  async list(
    actorUuid: string,
    input: { page: number; limit: number },
  ): Promise<{
    items: readonly ImportResult[];
    total: number;
  }> {
    const result = await this.jobs.list({
      actorUuid,
      page: input.page,
      limit: input.limit,
    });
    return {
      items: result.items.map((item) => this.toResult(item)),
      total: result.total,
    };
  }

  private toResult(job: SystemImportJobRecord): ImportResult {
    return {
      uuid: job.uuid,
      state: job.state,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      failedRows: job.failedRows,
      errors: job.errors,
      preview: job.preview,
    };
  }
}
