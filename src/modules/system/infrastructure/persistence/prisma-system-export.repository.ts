import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  SystemExportJobRecord,
  SystemExportRepository,
} from '../../domain/repositories/system-export.repository.js';

const toRecord = (row: {
  uuid: string;
  actorUuid: string;
  entity: string;
  format: string;
  state: string;
  filters: unknown;
  artifactPath: string | null;
  downloadTokenHash: string | null;
  rows: number;
  estimatedRows: number | null;
  processedRows: number;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelRequested: boolean;
  artifactBytes: bigint | null;
  expiresAt: Date;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SystemExportJobRecord => ({
  ...row,
  entity: row.entity as 'system_activity',
  format: row.format as 'csv' | 'json',
  state: row.state as SystemExportJobRecord['state'],
  filters:
    row.filters &&
    typeof row.filters === 'object' &&
    !Array.isArray(row.filters)
      ? (row.filters as Record<string, unknown>)
      : {},
});

@Injectable()
export class PrismaSystemExportRepository implements SystemExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    uuid: string;
    actorUuid: string;
    entity: 'system_activity';
    format: 'csv' | 'json';
    filters: Record<string, unknown>;
    expiresAt: Date;
    estimatedRows?: number | null;
  }) {
    const row = await this.prisma.systemExportJob.create({
      data: {
        ...input,
        state: 'QUEUED',
        rows: 0,
        estimatedRows: input.estimatedRows ?? null,
        processedRows: 0,
        completedAt: null,
        cancelledAt: null,
        cancelRequested: false,
        artifactBytes: null,
        artifactPath: null,
        downloadTokenHash: null,
        errorMessage: null,
      },
    });
    return toRecord(row);
  }

  async findByUuid(uuid: string, actorUuid?: string) {
    const row = await this.prisma.systemExportJob.findFirst({
      where: { uuid, ...(actorUuid ? { actorUuid } : {}) },
    });
    return row ? toRecord(row) : null;
  }

  async findByTokenHash(uuid: string, tokenHash: string) {
    const row = await this.prisma.systemExportJob.findFirst({
      where: { uuid, downloadTokenHash: tokenHash },
    });
    return row ? toRecord(row) : null;
  }

  async countRunning(): Promise<number> {
    return this.prisma.systemExportJob.count({ where: { state: 'RUNNING' } });
  }

  async update(
    uuid: string,
    input: Partial<
      Pick<
        SystemExportJobRecord,
        | 'state'
        | 'artifactPath'
        | 'downloadTokenHash'
        | 'rows'
        | 'estimatedRows'
        | 'processedRows'
        | 'completedAt'
        | 'cancelledAt'
        | 'cancelRequested'
        | 'artifactBytes'
        | 'expiresAt'
        | 'errorMessage'
      >
    >,
  ) {
    const row = await this.prisma.systemExportJob.update({
      where: { uuid },
      data: input,
    });
    return toRecord(row);
  }

  async list(input: {
    actorUuid: string;
    page: number;
    limit: number;
    state?: SystemExportJobRecord['state'];
  }) {
    const where = {
      actorUuid: input.actorUuid,
      ...(input.state ? { state: input.state } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.systemExportJob.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.systemExportJob.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }

  async deleteExpired(now: Date, limit: number) {
    const rows = await this.prisma.systemExportJob.findMany({
      where: {
        expiresAt: { lte: now },
        state: { in: ['SUCCEEDED', 'FAILED', 'CANCELLED'] },
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    if (rows.length > 0) {
      await this.prisma.systemExportJob.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
    }
    return rows.map(toRecord);
  }
}
