import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma/prisma.service.js';
import type {
  SecurityAuditEvent,
  SecurityAuditRepository,
} from '../../common/audit/security-audit.port.js';

type UserDelegate = {
  findFirst(args: unknown): Promise<{ id: bigint } | null>;
};
type RoleDelegate = {
  findFirst(args: unknown): Promise<{ id: bigint } | null>;
};
type PermissionDelegate = {
  findFirst(args: unknown): Promise<{ id: bigint } | null>;
};
type AuditLogDelegate = {
  create(args: unknown): Promise<{ id: bigint }>;
};
type AuditChangeDelegate = {
  create(args: unknown): Promise<unknown>;
};

type PrismaShape = {
  authenticationUser: UserDelegate;
  authorizationRole: RoleDelegate;
  authorizationPermission: PermissionDelegate;
  auditLog: AuditLogDelegate;
  auditLogChange: AuditChangeDelegate;
};

@Injectable()
export class PrismaSecurityAuditRepository implements SecurityAuditRepository {
  private readonly users: UserDelegate;
  private readonly roles: RoleDelegate;
  private readonly permissions: PermissionDelegate;
  private readonly auditLogs: AuditLogDelegate;
  private readonly auditChanges: AuditChangeDelegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaShape;
    this.users = client.authenticationUser;
    this.roles = client.authorizationRole;
    this.permissions = client.authorizationPermission;
    this.auditLogs = client.auditLog;
    this.auditChanges = client.auditLogChange;
  }

  async record(event: SecurityAuditEvent): Promise<void> {
    const userId = event.userUuid
      ? ((
          await this.users.findFirst({
            where: { uuid: event.userUuid },
            select: { id: true },
          })
        )?.id ?? null)
      : null;

    let entityId: bigint | null = null;
    if (event.entityUuid && event.entityType === 'AuthorizationRole') {
      entityId =
        (
          await this.roles.findFirst({
            where: { uuid: event.entityUuid },
            select: { id: true },
          })
        )?.id ?? null;
    }
    if (event.entityUuid && event.entityType === 'AuthorizationPermission') {
      entityId =
        (
          await this.permissions.findFirst({
            where: { uuid: event.entityUuid },
            select: { id: true },
          })
        )?.id ?? null;
    }

    const log = await this.auditLogs.create({
      data: {
        uuid: randomUUID(),
        userId,
        action: event.action,
        entityType: event.entityType ?? 'Authentication',
        entityId,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        requestId: event.requestId ?? null,
      },
    });

    for (const change of event.changes ?? []) {
      await this.auditChanges.create({
        data: {
          auditLogId: log.id,
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
        },
      });
    }
  }
}
