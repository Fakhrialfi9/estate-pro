import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  IntegrationOperationRecord,
} from '../../domain/repositories/system-roadmap.repository.js';
import type {
  SystemIntegrationOperationRetryRepository,
} from '../../domain/repositories/system-integration-operation-retry.repository.js';

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

@Injectable()
export class PrismaSystemIntegrationOperationRetryRepository
  implements SystemIntegrationOperationRetryRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async claimDue(
    integrationId: bigint,
    now: Date,
    limit = 20,
  ): Promise<readonly IntegrationOperationRecord[]> {
    const candidates = await this.prisma.systemIntegrationOperation.findMany({
      where: {
        integrationId,
        state: 'RETRY_SCHEDULED',
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: Math.min(100, Math.max(1, limit)),
    });

    const claimed: IntegrationOperationRecord[] = [];
    for (const candidate of candidates) {
      const result = await this.prisma.systemIntegrationOperation.updateMany({
        where: {
          uuid: candidate.uuid,
          state: 'RETRY_SCHEDULED',
          nextAttemptAt: { lte: now },
        },
        data: {
          state: 'RUNNING',
          attempt: { increment: 1 },
          startedAt: now,
          nextAttemptAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });
      if (result.count !== 1) continue;
      const row = await this.prisma.systemIntegrationOperation.findUniqueOrThrow({
        where: { uuid: candidate.uuid },
      });
      claimed.push({
        ...row,
        requestPayload: object(row.requestPayload),
        responsePayload: object(row.responsePayload),
        metadata: object(row.metadata),
      });
    }
    return claimed;
  }
}
