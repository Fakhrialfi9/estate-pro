import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  ImportColumnMapping,
  ImportConflictStrategy,
  ImportFieldMapping,
  ImportTransactionStrategy,
} from '../../domain/import/import-mapping.contracts.js';
import type { ImportState } from '../../domain/system-public.contracts.js';
import type {
  SystemImportJobRecord,
  SystemImportRepository,
} from '../../domain/repositories/system-import.repository.js';

const objectArray = <T>(value: unknown): readonly T[] =>
  Array.isArray(value) ? (value as readonly T[]) : [];

const toRecord = (row: {
  uuid: string;
  actorUuid: string;
  filename: string;
  format: string;
  state: string;
  preview: boolean;
  idempotencyKey: string | null;
  columnMapping: Prisma.JsonValue;
  fieldMapping: Prisma.JsonValue;
  conflictStrategy: string;
  transactionStrategy: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errors: Prisma.JsonValue;
  sourcePath: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): SystemImportJobRecord => ({
  uuid: row.uuid,
  actorUuid: row.actorUuid,
  filename: row.filename,
  format: row.format as 'csv' | 'json',
  state: row.state as ImportState,
  preview: row.preview,
  idempotencyKey: row.idempotencyKey,
  columnMapping: objectArray<ImportColumnMapping>(row.columnMapping),
  fieldMapping: objectArray<ImportFieldMapping>(row.fieldMapping),
  conflictStrategy: row.conflictStrategy as ImportConflictStrategy,
  transactionStrategy: row.transactionStrategy as ImportTransactionStrategy,
  totalRows: row.totalRows,
  processedRows: row.processedRows,
  failedRows: row.failedRows,
  errors: objectArray<{ row: number; field?: string; message: string }>(
    row.errors,
  ),
  sourcePath: row.sourcePath,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class PrismaSystemImportRepository implements SystemImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    uuid: string;
    actorUuid: string;
    filename: string;
    format: 'csv' | 'json';
    preview: boolean;
    idempotencyKey?: string | null;
    columnMapping: readonly ImportColumnMapping[];
    fieldMapping: readonly ImportFieldMapping[];
    conflictStrategy: ImportConflictStrategy;
    transactionStrategy: ImportTransactionStrategy;
    sourcePath: string | null;
    expiresAt: Date;
  }): Promise<SystemImportJobRecord> {
    const row = await this.prisma.systemImportJob.create({
      data: {
        uuid: input.uuid,
        actorUuid: input.actorUuid,
        filename: input.filename,
        format: input.format,
        preview: input.preview,
        idempotencyKey: input.idempotencyKey ?? null,
        columnMapping: input.columnMapping as unknown as Prisma.InputJsonValue,
        fieldMapping: input.fieldMapping as unknown as Prisma.InputJsonValue,
        conflictStrategy: input.conflictStrategy,
        transactionStrategy: input.transactionStrategy,
        sourcePath: input.sourcePath,
        expiresAt: input.expiresAt,
        state: 'QUEUED',
        totalRows: 0,
        processedRows: 0,
        failedRows: 0,
        errors: [],
      },
    });
    return toRecord(row);
  }

  async findByUuid(uuid: string, actorUuid?: string) {
    const row = await this.prisma.systemImportJob.findFirst({
      where: { uuid, ...(actorUuid ? { actorUuid } : {}) },
    });
    return row ? toRecord(row) : null;
  }

  async findByIdempotencyKey(key: string, actorUuid: string) {
    const row = await this.prisma.systemImportJob.findFirst({
      where: { idempotencyKey: key, actorUuid },
    });
    return row ? toRecord(row) : null;
  }

  async update(
    uuid: string,
    input: Partial<
      Pick<
        SystemImportJobRecord,
        | 'state'
        | 'totalRows'
        | 'processedRows'
        | 'failedRows'
        | 'errors'
        | 'sourcePath'
        | 'expiresAt'
      >
    >,
  ) {
    const row = await this.prisma.systemImportJob.update({
      where: { uuid },
      data: {
        ...input,
        ...(input.errors
          ? { errors: input.errors as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    return toRecord(row);
  }

  async list(input: {
    actorUuid: string;
    page: number;
    limit: number;
    state?: ImportState;
  }) {
    const where = {
      actorUuid: input.actorUuid,
      ...(input.state ? { state: input.state } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.systemImportJob.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.systemImportJob.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }

  async listExpired(now: Date, limit: number) {
    const rows = await this.prisma.systemImportJob.findMany({
      where: {
        expiresAt: { lte: now },
        state: { in: ['SUCCEEDED', 'FAILED', 'CANCELLED', 'RETRYABLE'] },
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map(toRecord);
  }

  async deleteMany(uuids: readonly string[]): Promise<void> {
    if (uuids.length === 0) return;
    await this.prisma.systemImportJob.deleteMany({
      where: { uuid: { in: [...uuids] } },
    });
  }
}
