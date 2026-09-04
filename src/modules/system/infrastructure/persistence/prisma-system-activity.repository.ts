import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import type { SystemActivityRecord } from '../../domain/system.types.js';

const toRecord = (row: {
  uuid: string;
  actorUuid: string | null;
  eventType: string;
  category: string;
  resourceType: string | null;
  resourceUuid: string | null;
  summary: string;
  metadata: unknown;
  requestId: string | null;
  createdAt: Date;
}): SystemActivityRecord => ({
  uuid: row.uuid,
  actorUuid: row.actorUuid,
  eventType: row.eventType,
  category: row.category,
  resourceType: row.resourceType,
  resourceUuid: row.resourceUuid,
  summary: row.summary,
  metadata:
    row.metadata &&
    typeof row.metadata === 'object' &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {},
  requestId: row.requestId,
  createdAt: row.createdAt,
});

@Injectable()
export class PrismaSystemActivityRepository
  implements SystemActivityRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async append(
    input: Omit<SystemActivityRecord, 'uuid' | 'createdAt'> & {
      uuid?: string;
      createdAt?: Date;
    },
  ) {
    const row = await this.prisma.systemActivity.create({
      data: {
        uuid: input.uuid ?? randomUUID(),
        actorUuid: input.actorUuid,
        eventType: input.eventType,
        category: input.category,
        resourceType: input.resourceType,
        resourceUuid: input.resourceUuid,
        summary: input.summary
          .normalize('NFKC')
          .replace(/[\p{Cc}]/gu, '')
          .trim()
          .slice(0, 500),
        metadata: input.metadata,
        requestId: input.requestId,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    });
    return toRecord(row);
  }

  async list(input: {
    page: number;
    limit: number;
    actorUuid?: string;
    eventType?: string;
    category?: string;
    resourceType?: string;
    resourceUuid?: string;
  }) {
    const where = {
      ...(input.actorUuid ? { actorUuid: input.actorUuid } : {}),
      ...(input.eventType ? { eventType: input.eventType } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.resourceType ? { resourceType: input.resourceType } : {}),
      ...(input.resourceUuid ? { resourceUuid: input.resourceUuid } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.systemActivity.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.systemActivity.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }
}
