import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  IntegrationState,
  SystemIntegrationRecord,
} from '../../domain/integration/integration.contracts.js';
import type { SystemIntegrationRepository } from '../../domain/repositories/system-integration.repository.js';

const toRecord = (row: {
  id: bigint;
  uuid: string;
  providerKey: string;
  providerVersion: string;
  capabilities: unknown;
  state: string;
  metadata: unknown;
  secretRef: string | null;
  lastTestAt: Date | null;
  lastSyncAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SystemIntegrationRecord => ({
  ...row,
  capabilities: Array.isArray(row.capabilities)
    ? row.capabilities.filter((value): value is string => typeof value === 'string')
    : [],
  state: row.state as IntegrationState,
  metadata:
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {},
});

@Injectable()
export class PrismaSystemIntegrationRepository
  implements SystemIntegrationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    uuid: string;
    providerKey: string;
    providerVersion: string;
    capabilities: readonly string[];
    state: IntegrationState;
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }) {
    const row = await this.prisma.systemIntegration.create({
      data: {
        ...input,
        capabilities: [...input.capabilities],
        metadata: input.metadata as Prisma.InputJsonObject,
        secretRef: input.secretRef ?? null,
      },
    });
    return toRecord(row);
  }

  async get(uuid: string) {
    const row = await this.prisma.systemIntegration.findUnique({
      where: { uuid },
    });
    return row ? toRecord(row) : null;
  }

  async list(input: { page: number; limit: number; state?: IntegrationState }) {
    const where = input.state ? { state: input.state } : {};
    const [items, total] = await Promise.all([
      this.prisma.systemIntegration.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.systemIntegration.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }

  async update(
    uuid: string,
    input: Partial<
      Pick<
        SystemIntegrationRecord,
        | 'state'
        | 'metadata'
        | 'secretRef'
        | 'lastTestAt'
        | 'lastSyncAt'
        | 'errorCode'
        | 'errorMessage'
      >
    >,
  ) {
    try {
      const data: Prisma.SystemIntegrationUpdateInput = {
        state: input.state,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        secretRef: input.secretRef,
        lastTestAt: input.lastTestAt,
        lastSyncAt: input.lastSyncAt,
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonObject }
          : {}),
      };
      const row = await this.prisma.systemIntegration.update({
        where: { uuid },
        data,
      });
      return toRecord(row);
    } catch {
      throw new NotFoundException('Integration not found');
    }
  }

  async delete(uuid: string) {
    try {
      await this.prisma.systemIntegration.delete({ where: { uuid } });
    } catch {
      throw new NotFoundException('Integration not found');
    }
  }
}
