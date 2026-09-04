import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import type { SystemActivityRecord } from '../../domain/system.types.js';

type PersistedActivity = {
  id: bigint;
  uuid: string;
  actorUuid: string | null;
  eventType: string;
  category: string;
  resourceType: string | null;
  resourceUuid: string | null;
  summary: string;
  metadata: Prisma.JsonValue;
  requestId: string | null;
  createdAt: Date;
};

const toRecord = (row: PersistedActivity): SystemActivityRecord => ({
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
      ? row.metadata
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
  ): Promise<SystemActivityRecord> {
    const row = await this.prisma.systemActivity.create({
      data: {
        uuid: input.uuid ?? randomUUID(),
        actorUuid: input.actorUuid,
        eventType: input.eventType,
        category: input.category,
        resourceType: input.resourceType,
        resourceUuid: input.resourceUuid,
        summary: input.summary,
        metadata: input.metadata as Prisma.InputJsonValue,
        requestId: input.requestId,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    });
    return toRecord(row);
  }

  async get(uuid: string): Promise<SystemActivityRecord | null> {
    const row = await this.prisma.systemActivity.findUnique({
      where: { uuid },
    });
    return row ? toRecord(row) : null;
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
