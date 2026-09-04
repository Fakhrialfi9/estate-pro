import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { ExportFormat } from '../../domain/system-public.contracts.js';
import type { SystemExportJobRecord, SystemExportRepository } from '../../domain/repositories/system-export.repository.js';

const toRecord = (row: { uuid: string; actorUuid: string; entity: string; format: string; state: string; filters: unknown; artifactPath: string | null; downloadTokenHash: string | null; rows: number; estimatedRows: number | null; processedRows: number; completedAt: Date | null; cancelledAt: Date | null; cancelRequested: boolean; artifactBytes: bigint | null; expiresAt: Date; errorMessage: string | null; createdAt: Date; updatedAt: Date }): SystemExportJobRecord => ({
  ...row,
  entity: row.entity as 'system_activity',
  format: row.format as ExportFormat,
  state: row.state as SystemExportJobRecord['state'],
  filters: row.filters && typeof row.filters === 'object' && !Array.isArray(row.filters) ? (row.filters as Record<string, unknown>) : {},
});

@Injectable()
export class PrismaSystemExportRepository implements SystemExportRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(input: { uuid: string; actorUuid: string; entity: 'system_activity'; format: ExportFormat; filters: Record<string, unknown>; expiresAt: Date; estimatedRows?: number | null; downloadTokenHash?: string | null }) {
    const row = await this.prisma.systemExportJob.create({ data: {
      uuid: input.uuid, actorUuid: input.actorUuid, entity: input.entity, format: input.format,
      filters: input.filters as Prisma.InputJsonObject, expiresAt: input.expiresAt,
      estimatedRows: input.estimatedRows ?? null, state: 'QUEUED', rows: 0, processedRows: 0,
      completedAt: null, cancelledAt: null, cancelRequested: false, artifactBytes: null,
      artifactPath: null, downloadTokenHash: input.downloadTokenHash ?? null, errorMessage: null,
    } });
    return toRecord(row);
  }
  async findByUuid(uuid: string, actorUuid?: string) {
    const row = await this.prisma.systemExportJob.findFirst({ where: { uuid, ...(actorUuid ? { actorUuid } : {}) } });
    return row ? toRecord(row) : null;
  }
  async findByTokenHash(uuid: string, tokenHash: string) {
    const row = await this.prisma.systemExportJob.findFirst({ where: { uuid, downloadTokenHash: tokenHash } });
    return row ? toRecord(row) : null;
  }
  countRunning(): Promise<number> { return this.prisma.systemExportJob.count({ where: { state: 'RUNNING' } }); }
  async claimQueued() {
    const candidate = await this.prisma.systemExportJob.findFirst({ where: { state: 'QUEUED', expiresAt: { gt: new Date() } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (!candidate) return null;
    const claimed = await this.prisma.systemExportJob.updateMany({ where: { uuid: candidate.uuid, state: 'QUEUED' }, data: { state: 'RUNNING' } });
    if (claimed.count !== 1) return null;
    return this.findByUuid(candidate.uuid);
  }
  async update(uuid: string, input: Partial<Pick<SystemExportJobRecord, 'state' | 'artifactPath' | 'downloadTokenHash' | 'rows' | 'estimatedRows' | 'processedRows' | 'completedAt' | 'cancelledAt' | 'cancelRequested' | 'artifactBytes' | 'expiresAt' | 'errorMessage'>>) {
    const row = await this.prisma.systemExportJob.update({ where: { uuid }, data: input });
    return toRecord(row);
  }
  async list(input: { actorUuid: string; page: number; limit: number; state?: SystemExportJobRecord['state'] }) {
    const where = { actorUuid: input.actorUuid, ...(input.state ? { state: input.state } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.systemExportJob.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * input.limit, take: input.limit }),
      this.prisma.systemExportJob.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }
  async listExpired(now: Date, limit: number) {
    const rows = await this.prisma.systemExportJob.findMany({ where: { expiresAt: { lte: now }, state: { in: ['SUCCEEDED', 'FAILED', 'CANCELLED'] } }, orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }], take: limit });
    return rows.map(toRecord);
  }
  async deleteMany(uuids: readonly string[]): Promise<void> {
    if (uuids.length === 0) return;
    await this.prisma.systemExportJob.deleteMany({ where: { uuid: { in: [...uuids] } } });
  }
}
