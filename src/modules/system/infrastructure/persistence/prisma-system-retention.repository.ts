import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { SystemRetentionRepository } from '../../domain/repositories/system-retention.repository.js';

@Injectable()
export class PrismaSystemRetentionRepository
  implements SystemRetentionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async purgeActivity(before: Date, limit: number): Promise<number> {
    const rows = await this.prisma.systemActivity.findMany({
      where: { createdAt: { lt: before } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    if (rows.length === 0) return 0;
    const result = await this.prisma.systemActivity.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    return result.count;
  }

  async purgeAudit(before: Date, limit: number): Promise<number> {
    const rows = await this.prisma.auditLog.findMany({
      where: { createdAt: { lt: before } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    if (rows.length === 0) return 0;

    return this.prisma.$transaction(async (tx) => {
      await tx.auditLogChange.deleteMany({
        where: { auditLogId: { in: rows.map((row) => row.id) } },
      });
      const result = await tx.auditLog.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
      return result.count;
    });
  }
}
