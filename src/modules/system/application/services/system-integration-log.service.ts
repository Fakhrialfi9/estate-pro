import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

const MAX_LIMIT = 100;

@Injectable()
export class SystemIntegrationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    integrationUuid?: string;
    state?: string;
    operationKey?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? 50));
    const from = input.from ?? new Date(Date.now() - 86_400_000);
    const to = input.to ?? new Date();
    if (from >= to) throw new Error('Invalid integration log range');
    if (to.getTime() - from.getTime() > 90 * 86_400_000)
      throw new Error('Integration log range cannot exceed 90 days');

    const conditions = [
      Prisma.sql`o.created_at >= ${from}`,
      Prisma.sql`o.created_at < ${to}`,
    ];
    if (input.integrationUuid)
      conditions.push(Prisma.sql`i.uuid = ${input.integrationUuid}`);
    if (input.state) conditions.push(Prisma.sql`o.state = ${input.state}`);
    if (input.operationKey)
      conditions.push(Prisma.sql`o.operation_key = ${input.operationKey}`);

    const rows = await this.prisma.$queryRaw<
      Array<{
        uuid: string;
        integrationUuid: string;
        providerKey: string;
        operationKey: string;
        direction: string;
        state: string;
        attempt: number;
        maxAttempts: number;
        idempotencyKey: string;
        startedAt: Date | null;
        completedAt: Date | null;
        nextAttemptAt: Date | null;
        errorCode: string | null;
        createdAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        o.uuid,
        i.uuid AS integrationUuid,
        i.provider_key AS providerKey,
        o.operation_key AS operationKey,
        o.direction,
        o.state,
        o.attempt,
        o.max_attempts AS maxAttempts,
        o.idempotency_key AS idempotencyKey,
        o.started_at AS startedAt,
        o.completed_at AS completedAt,
        o.next_attempt_at AS nextAttemptAt,
        o.error_code AS errorCode,
        o.created_at AS createdAt
      FROM system_integration_operations o
      JOIN system_integrations i ON i.id = o.integration_id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `);

    return rows.map((row) => ({
      ...row,
      latencyMs:
        row.startedAt && row.completedAt
          ? Math.max(0, row.completedAt.getTime() - row.startedAt.getTime())
          : null,
    }));
  }
}
