import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../../prisma/generated/prisma/client.js';
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
        uuid: input.uuid,
        actorUuid: input.actorUuid,
        entity: input.entity,
        format: input.format,
        filters: input.filters as Prisma.InputJsonObject,
        expiresAt: input.expiresAt,
        estimatedRows: input.estimatedRows ?? null,
        state: 'QUEUED',
        rows: 0,
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
