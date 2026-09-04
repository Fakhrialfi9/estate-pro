import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { SystemImportRepository, SystemImportJobRecord } from '../../domain/repositories/system-import.repository.js';
import type { ImportState } from '../../domain/system-public.contracts.js';

const toRecord = (row: {
  uuid: string;
  actorUuid: string;
  filename: string;
  format: string;
  state: string;
  preview: boolean;
  idempotencyKey: string | null;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errors: unknown;
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
  totalRows: row.totalRows,
  processedRows: row.processedRows,
  failedRows: row.failedRows,
  errors: Array.isArray(row.errors)
    ? (row.errors as SystemImportJobRecord['errors'])
    : [],
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
    sourcePath: string | null;
    expiresAt: Date;
  }): Promise<SystemImportJobRecord> {
    const row = await this.prisma.systemImportJob.create({
      data: {
        ...input,
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
      data: input as never,
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
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.systemImportJob.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }
}
