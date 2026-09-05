import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  SystemActivityRepository,
  SystemActivitySort,
  SystemActivityWrite,
} from '../../domain/repositories/system-activity.repository.js';
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

const toData = (input: SystemActivityWrite): Prisma.SystemActivityCreateInput => ({
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
});

const toUpdate = (input: SystemActivityWrite): Prisma.SystemActivityUpdateInput => ({
  actorUuid: input.actorUuid,
  eventType: input.eventType,
  category: input.category,
  resourceType: input.resourceType,
  resourceUuid: input.resourceUuid,
  summary: input.summary,
  metadata: input.metadata as Prisma.InputJsonValue,
  requestId: input.requestId,
});

@Injectable()
export class PrismaSystemActivityRepository implements SystemActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: SystemActivityWrite) {
    return toRecord(await this.prisma.systemActivity.create({ data: toData(input) }));
  }

  async upsert(input: SystemActivityWrite) {
    const uuid = input.uuid ?? randomUUID();
    return toRecord(
      await this.prisma.systemActivity.upsert({
        where: { uuid },
        create: toData({ ...input, uuid }),
        update: toUpdate(input),
      }),
    );
  }

  async appendBatch(input: readonly SystemActivityWrite[]) {
    if (input.length === 0) return [];
    const rows = await this.prisma.$transaction(
      input.map((item) => this.prisma.systemActivity.create({ data: toData(item) })),
    );
    return rows.map(toRecord);
  }

  async upsertBatch(input: readonly SystemActivityWrite[]) {
    if (input.length === 0) return [];
    const rows = await this.prisma.$transaction(
      input.map((item) => {
        const uuid = item.uuid ?? randomUUID();
        return this.prisma.systemActivity.upsert({
          where: { uuid },
          create: toData({ ...item, uuid }),
          update: toUpdate(item),
        });
      }),
    );
    return rows.map(toRecord);
  }

  async get(uuid: string) {
    const row = await this.prisma.systemActivity.findUnique({ where: { uuid } });
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
    sort?: SystemActivitySort;
  }) {
    const where = {
      ...(input.actorUuid ? { actorUuid: input.actorUuid } : {}),
      ...(input.eventType ? { eventType: input.eventType } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.resourceType ? { resourceType: input.resourceType } : {}),
      ...(input.resourceUuid ? { resourceUuid: input.resourceUuid } : {}),
    };
    const direction = input.sort === 'createdAt_asc' ? 'asc' : 'desc';
    const [items, total] = await Promise.all([
      this.prisma.systemActivity.findMany({
        where,
        orderBy: [{ createdAt: direction }, { id: direction }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.systemActivity.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }
}
