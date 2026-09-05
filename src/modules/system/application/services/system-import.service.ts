import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import type { SystemActivityRepository, SystemActivityWrite } from '../../domain/repositories/system-activity.repository.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from '../../domain/repositories/system-activity.repository.js';
import type { SystemArtifactStorage } from '../../domain/repositories/system-artifact.storage.js';
import { SYSTEM_ARTIFACT_STORAGE } from '../../domain/repositories/system-artifact.storage.js';
import type { SystemImportJobRecord, SystemImportRepository } from '../../domain/repositories/system-import.repository.js';
import { SYSTEM_IMPORT_REPOSITORY } from '../../domain/repositories/system-import.repository.js';
import type { ImportColumnMapping, ImportConflictStrategy, ImportFieldMapping, ImportTransactionStrategy } from '../../domain/import/import-mapping.contracts.js';
import type { ImportFormat, ImportRequest, ImportResult } from '../../domain/system-public.contracts.js';
import { SystemImportMappingService } from './system-import-mapping.service.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_ERRORS = 500;
const BATCH_SIZE = 100;
const MAX_ALL_OR_NOTHING_ROWS = 1_000;
const EXPIRY_MS = 24 * 60 * 60 * 1000;

const sanitizeFilename = (value: string): string => Array.from(value).map((character) => character.charCodeAt(0) <= 31 || character === '/' || character === '\\' ? '_' : character).join('');
const stringValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const nullableString = (value: unknown): string | null => { const normalized = stringValue(value); return normalized || null; };

const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') { if (input[index + 1] === '"') { cell += '"'; index += 1; } else quoted = false; }
      else cell += character;
      continue;
    }
    if (character === '"' && cell === '') quoted = true;
    else if (character === ',') { row.push(cell); cell = ''; }
    else if (character === '\n') { row.push(cell.endsWith('\r') ? cell.slice(0, -1) : cell); rows.push(row); row = []; cell = ''; }
    else cell += character;
  }
  if (quoted) throw new BadRequestException('Malformed CSV quoting');
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
};

const parseRows = (content: string, format: ImportFormat): Record<string, unknown>[] => {
  if (format === 'json') {
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new BadRequestException('Invalid JSON import payload'); }
    if (!Array.isArray(parsed)) throw new BadRequestException('JSON import must contain an array of objects');
    return parsed.map((value, index) => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(`Invalid row ${index + 1}`); return value as Record<string, unknown>; });
  }
  const rows = parseCsv(content);
  if (!rows.length) return [];
  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((value) => value.trim());
  if (headers.some((value) => !value) || new Set(headers).size !== headers.length) throw new BadRequestException('CSV headers must be non-empty and unique');
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
};

@Injectable()
export class SystemImportService {
  constructor(
    @Inject(SYSTEM_IMPORT_REPOSITORY) private readonly jobs: SystemImportRepository,
    @Inject(SYSTEM_ACTIVITY_REPOSITORY) private readonly activity: SystemActivityRepository,
    @Inject(SYSTEM_ARTIFACT_STORAGE) private readonly storage: SystemArtifactStorage,
    @Inject(SECURITY_AUDIT_REPOSITORY) private readonly audit: SecurityAuditRepository,
    private readonly mapping: SystemImportMappingService,
  ) {}

  async execute(actorUuid: string, input: ImportRequest): Promise<ImportResult> {
    if (!actorUuid) throw new BadRequestException('Authenticated actor missing');
    const format = this.resolveFormat(input.filename, input.format);
    const buffer = Buffer.from(input.contentBase64 ?? '', 'base64');
    if (!buffer.length) throw new BadRequestException('Import content is required');
    if (buffer.length > MAX_FILE_BYTES) throw new BadRequestException('Import file exceeds 5 MiB limit');
    const columnMapping = input.columnMapping ?? [];
    const fieldMapping = input.fieldMapping ?? [];
    const conflictStrategy = input.conflictStrategy ?? 'FAIL';
    const transactionStrategy = input.transactionStrategy ?? 'ROW';
    this.mapping.validateFieldMapping(fieldMapping);
    const content = buffer.toString('utf8');
    const idempotencyKey = input.idempotencyKey?.trim() || createHash('sha256').update(`${actorUuid}:${input.filename}:${content}`).digest('hex');
    const existing = await this.jobs.findByIdempotencyKey(idempotencyKey, actorUuid);
    if (existing) return this.toResult(existing);
    const job = await this.jobs.create({ uuid: randomUUID(), actorUuid, filename: sanitizeFilename(input.filename), format, preview: input.preview === true, idempotencyKey, columnMapping, fieldMapping, conflictStrategy, transactionStrategy, sourcePath: null, expiresAt: new Date(Date.now() + EXPIRY_MS) });
    await this.audit.record({ action: 'SYSTEM_IMPORT_CREATED', actorUuid, subjectUuid: actorUuid, entityType: 'system_import', entityUuid: job.uuid, result: 'SUCCESS', reason: `format=${format};transaction=${transactionStrategy};conflict=${conflictStrategy}` });

    try {
      const stored = await this.storage.put(job.uuid, buffer, 'source');
      await this.jobs.update(job.uuid, { state: 'RUNNING', sourcePath: stored.path });
      const rows = parseRows(content, format);
      if (rows.length > MAX_ROWS) throw new BadRequestException(`Import contains more than ${MAX_ROWS} rows`);
      if (transactionStrategy === 'ALL_OR_NOTHING' && rows.length > MAX_ALL_OR_NOTHING_ROWS) throw new BadRequestException(`ALL_OR_NOTHING is limited to ${MAX_ALL_OR_NOTHING_ROWS} rows`);
      if (format === 'csv' && columnMapping.length) this.mapping.validateColumnMapping(columnMapping, rows[0] ? Object.keys(rows[0]) : []);
      const mappedRows = rows.map((row) => this.mapping.applyFieldMapping(this.mapping.applyColumnMapping(row, columnMapping), fieldMapping));
      const prepared = mappedRows.map((row, index) => this.prepareRow(row, actorUuid, idempotencyKey, index + 2));
      const errors: { row: number; field?: string; message: string }[] = [];
      const writes: { index: number; existing: boolean; data: SystemActivityWrite }[] = [];
      for (const candidate of prepared) {
        if (!candidate.data) { errors.push(candidate.error); continue; }
        const existingRow = await this.activity.get(candidate.data.uuid);
        if (existingRow) {
          if (conflictStrategy === 'FAIL') { errors.push({ row: candidate.row, message: 'Target record already exists' }); continue; }
          if (conflictStrategy === 'SKIP') continue;
        }
        writes.push({ index: candidate.row - 2, existing: Boolean(existingRow), data: candidate.data });
      }
      if (transactionStrategy === 'ALL_OR_NOTHING' && errors.length) return await this.finish(job, actorUuid, { state: 'FAILED', totalRows: rows.length, processedRows: 0, failedRows: errors.length, errors });
      let processed = 0;
      if (!input.preview) {
        if (transactionStrategy === 'ALL_OR_NOTHING') {
          const needsUpsert = conflictStrategy === 'UPDATE' || conflictStrategy === 'UPSERT' || writes.some((item) => item.existing);
          if (needsUpsert) await this.activity.upsertBatch(writes.map((item) => item.data));
          else await this.activity.appendBatch(writes.map((item) => item.data));
          processed = writes.length;
        } else if (transactionStrategy === 'ROW') {
          for (const write of writes) {
            try {
              if (conflictStrategy === 'UPDATE' || conflictStrategy === 'UPSERT' || write.existing) await this.activity.upsert(write.data);
              else await this.activity.append(write.data);
              processed += 1;
            } catch { if (errors.length < MAX_ERRORS) errors.push({ row: write.index + 2, message: 'Row persistence failed' }); }
          }
        } else {
          for (let offset = 0; offset < writes.length; offset += BATCH_SIZE) {
            const batch = writes.slice(offset, offset + BATCH_SIZE);
            try {
              const needsUpsert = conflictStrategy === 'UPDATE' || conflictStrategy === 'UPSERT' || batch.some((item) => item.existing);
              if (needsUpsert) await this.activity.upsertBatch(batch.map((item) => item.data));
              else await this.activity.appendBatch(batch.map((item) => item.data));
              processed += batch.length;
            } catch {
              for (const write of batch) { if (errors.length >= MAX_ERRORS) break; errors.push({ row: write.index + 2, message: 'Batch persistence failed' }); }
            }
          }
        }
      } else processed = writes.length;
      return await this.finish(job, actorUuid, { state: errors.length ? 'FAILED' : 'SUCCEEDED', totalRows: rows.length, processedRows: processed, failedRows: errors.length, errors: errors.slice(0, MAX_ERRORS) });
    } catch (error: unknown) {
      const message = error instanceof BadRequestException ? String(error.message) : 'Import failed';
      return await this.finish(job, actorUuid, { state: 'FAILED', totalRows: job.totalRows, processedRows: job.processedRows, failedRows: Math.max(1, job.failedRows), errors: [{ row: 0, message: message.slice(0, 500) }] });
    }
  }

  async get(actorUuid: string, uuid: string): Promise<ImportResult> { const job = await this.jobs.findByUuid(uuid, actorUuid); if (!job) throw new NotFoundException('Import job not found'); return this.toResult(job); }
  async failedRowReport(actorUuid: string, uuid: string) { const row = await this.jobs.findByUuid(uuid, actorUuid); if (!row) throw new NotFoundException('Import job not found'); return { importUuid: row.uuid, state: row.state, failedRows: row.failedRows, errors: row.errors, generatedAt: new Date().toISOString() }; }
  async retry(actorUuid: string, uuid: string): Promise<ImportResult> { const row = await this.jobs.findByUuid(uuid, actorUuid); if (!row) throw new NotFoundException('Import job not found'); if (!['FAILED', 'RETRYABLE'].includes(row.state)) throw new BadRequestException('Import job is not retryable'); if (!row.sourcePath) throw new BadRequestException('Original import source is unavailable'); if (row.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Original import source has expired'); const data = await this.storage.read(row.sourcePath); return this.execute(actorUuid, { filename: row.filename, contentBase64: data.toString('base64'), format: row.format, idempotencyKey: `${row.idempotencyKey ?? row.uuid}:retry`, preview: row.preview, columnMapping: row.columnMapping, fieldMapping: row.fieldMapping, conflictStrategy: row.conflictStrategy, transactionStrategy: row.transactionStrategy }); }
  async cancel(actorUuid: string, uuid: string): Promise<ImportResult> { const row = await this.jobs.findByUuid(uuid, actorUuid); if (!row) throw new NotFoundException('Import job not found'); if (!['QUEUED', 'RUNNING'].includes(row.state)) throw new BadRequestException('Import job is not cancellable'); return this.toResult(await this.jobs.update(uuid, { state: 'CANCELLED' })); }
  async list(actorUuid: string, page = 1, limit = 20, state?: ImportResult['state']) { const normalizedPage = Math.max(1, page); const normalizedLimit = Math.min(100, Math.max(1, limit)); const result = await this.jobs.list({ actorUuid, page: normalizedPage, limit: normalizedLimit, state }); return { items: result.items.map((row) => this.toResult(row)), total: result.total, page: normalizedPage, limit: normalizedLimit }; }

  private resolveFormat(filename: string, format?: ImportFormat): ImportFormat { const resolved = format ?? (filename.toLowerCase().endsWith('.json') ? 'json' : filename.toLowerCase().endsWith('.csv') ? 'csv' : undefined); if (!filename || filename.length > 255 || !resolved) throw new BadRequestException('Only CSV and JSON imports are supported'); return resolved; }
  private prepareRow(row: Record<string, unknown>, actorUuid: string, idempotencyKey: string, rowNumber: number): { row: number; data?: SystemActivityWrite; error: { row: number; field?: string; message: string } } { const eventType = stringValue(row.eventType); const category = stringValue(row.category); const summary = stringValue(row.summary); if (!eventType || !category || !summary) return { row: rowNumber, error: { row: rowNumber, message: 'eventType, category and summary are required' } }; const uuid = createHash('sha256').update(`${idempotencyKey}:${rowNumber}:${JSON.stringify(row)}`).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5'); return { row: rowNumber, data: { uuid, actorUuid, eventType, category, resourceType: nullableString(row.resourceType), resourceUuid: nullableString(row.resourceUuid), summary, metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {}, requestId: nullableString(row.requestId) }, error: { row: rowNumber, message: '' } }; }
  private async finish(job: SystemImportJobRecord, actorUuid: string, input: Pick<SystemImportJobRecord, 'state' | 'totalRows' | 'processedRows' | 'failedRows' | 'errors'>): Promise<ImportResult> { const updated = await this.jobs.update(job.uuid, input); await this.audit.record({ action: updated.state === 'SUCCEEDED' ? 'SYSTEM_IMPORT_COMMITTED' : 'SYSTEM_IMPORT_FAILED', actorUuid, subjectUuid: actorUuid, entityType: 'system_import', entityUuid: job.uuid, result: updated.state === 'SUCCEEDED' ? 'SUCCESS' : 'FAILURE', reason: `processed=${updated.processedRows};failed=${updated.failedRows}` }); return this.toResult(updated); }
  private toResult(job: SystemImportJobRecord): ImportResult { return { uuid: job.uuid, state: job.state, totalRows: job.totalRows, processedRows: job.processedRows, failedRows: job.failedRows, errors: job.errors, preview: job.preview }; }
}
