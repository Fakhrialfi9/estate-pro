import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import type {
  SecurityAuditEvent,
  SecurityAuditRepository,
} from '../../modules/auth/domain/repositories/security-audit.repository.js';

type Delegate = {
  findFirst(args: unknown): Promise<{ id: bigint } | null>;
  create(args: unknown): Promise<unknown>;
};

type PrismaShape = {
  authenticationUser: Delegate;
  auditLog: Delegate;
};

@Injectable()
export class PrismaSecurityAuditRepository implements SecurityAuditRepository {
  private readonly users: Delegate;
  private readonly auditLogs: Delegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaShape;
    this.users = client.authenticationUser;
    this.auditLogs = client.auditLog;
  }

  async record(event: SecurityAuditEvent): Promise<void> {
    let userId: bigint | null = null;
    if (event.userUuid) {
      const user = await this.users.findFirst({
        where: { uuid: event.userUuid },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }

    await this.auditLogs.create({
      data: {
        uuid: randomUUID(),
        userId,
        action: event.action,
        entityType: 'Authentication',
        entityId: null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        requestId: event.requestId ?? null,
      },
    });
  }
}
