import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma/prisma.service.js';
import type {
  SecurityAuditRepository,
  SecurityAuditEvent,
} from '../../common/audit/security-audit.port.js';
import { AUDIT_RESOURCE_TYPES } from '../../common/audit/audit-events.js';
import {
  normalizeAuditResourceType,
  sanitizeAuditChanges,
  sanitizeAuditReason,
  sanitizeAuditRequestId,
  sanitizeAuditUserAgent,
} from '../../common/audit/audit-redaction.js';
import type {
  AuditLogEntity,
  AuditLogChangeEntityProps,
} from '../../modules/audit/domain/entities/audit-log.entity.js';
import type {
  AuditLogListQuery,
  AuditLogListResult,
  AuditLogRepository,
  AuditLogWriteEvent,
} from '../../modules/audit/domain/repositories/audit-log.repository.js';

const MAX_PAGE_SIZE = 100;
const ALLOWED_ACTIONS = new Set<string>([
  'AUTHENTICATION_SUCCESS',
  'AUTHENTICATION_FAILURE',
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DELETED',
  'PERMISSION_CREATED',
  'PERMISSION_UPDATED',
  'PERMISSION_DELETED',
  'ROLE_PERMISSION_ASSIGNED',
  'ROLE_PERMISSION_REMOVED',
  'USER_ROLE_ASSIGNED',
  'USER_ROLE_REMOVED',
  'SESSION_CREATED',
  'SESSION_REVOKED',
  'LOGOUT',
  'LOGOUT_ALL',
  'LOGOUT_ALL_SESSIONS',
  '2FA_ENROLLMENT',
  '2FA_ENABLED',
  '2FA_DISABLED',
  '2FA_RECOVERY_CODE_USED',
  '2FA_RECOVERY_CODES_REGENERATED',
  'RECOVERY_CODE_USED',
  'RECOVERY_CODES_REGENERATED',
  'AUDIT_LOG_ACCESSED',
  'ROLE_DELETE_BLOCKED',
  'PERMISSION_DELETE_BLOCKED',
  'SYSTEM_ROLE_UPDATED',
  'SYSTEM_ROLE_DELETE_ATTEMPTED',
  'SYSTEM_PERMISSION_UPDATE_ATTEMPTED',
  'SYSTEM_PERMISSION_DELETE_ATTEMPTED',
  'SESSION_ADMIN_REVOKED',
  'PASSWORD_CHANGE_SESSION_REVOKED',
  'SECURITY_EVENT_SESSION_REVOKED',
  'TWO_FACTOR_VERIFICATION_FAILURE',
]);
const FAILURE_ACTION_PATTERN = /(FAILURE|BLOCKED|ATTEMPTED)$/;
const ADMIN_RESOURCE_TYPES = new Set([
  'user',
  'role',
  'permission',
  'role_permission',
  'user_role',
]);

interface AuditShape {
  authenticationUser: {
    findFirst(args: unknown): Promise<{ id: bigint; uuid: string } | null>;
  };
  authorizationRole: {
    findFirst(args: unknown): Promise<{ id: bigint; uuid: string } | null>;
  };
  authorizationPermission: {
    findFirst(args: unknown): Promise<{ id: bigint; uuid: string } | null>;
  };
  auditLog: {
    create(args: unknown): Promise<{ id: bigint }>;
    findMany(args: unknown): Promise<AuditRecord[]>;
    count(args: unknown): Promise<number>;
  };
  auditLogChange: { createMany(args: unknown): Promise<unknown> };
  $transaction<T>(callback: (tx: AuditShape) => Promise<T>): Promise<T>;
}

type AuditRecord = {
  uuid: string;
  action: string;
  actorType: string;
  actorUser: { uuid: string } | null;
  subjectUser: { uuid: string } | null;
  entityType: string | null;
  resourceId: string | null;
  result: string;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
  changes: Array<{
    id: bigint;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
};

@Injectable()
export class PrismaSecurityAuditRepository
  implements SecurityAuditRepository, AuditLogRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async record(event: SecurityAuditEvent | AuditLogWriteEvent): Promise<void> {
    if (!ALLOWED_ACTIONS.has(event.action))
      throw new Error('Unsupported audit action');
    const resourceType = normalizeAuditResourceType(
      event.entityType ?? 'authentication',
    );
    if (
      resourceType &&
      !(AUDIT_RESOURCE_TYPES as readonly string[]).includes(resourceType)
    )
      throw new Error('Unsupported audit resource');
    const actorUuid =
      event.actorUuid ?? (event as SecurityAuditEvent).userUuid ?? null;
    const subjectUuid =
      event.subjectUuid ??
      (resourceType === 'user' ? (event.entityUuid ?? null) : null);
    const inferredActorType = this.inferActorType(
      event,
      resourceType,
      actorUuid,
    );
    const actorType = event.actorType ?? inferredActorType;
    const safeIp =
      event.ipAddress && isIP(event.ipAddress) !== 0 ? event.ipAddress : null;
    const maxUa = this.config.get<number>('audit.userAgentMaxLength', 1024);
    const safeUserAgent = sanitizeAuditUserAgent(event.userAgent, maxUa);
    const safeRequestId = sanitizeAuditRequestId(event.requestId);
    const safeChanges = sanitizeAuditChanges(
      resourceType ?? 'authentication',
      event.changes,
    );
    const inferredReason = event.changes?.find(
      (change) =>
        change.field === 'reason' && typeof change.newValue === 'string',
    )?.newValue as string | undefined;
    const result =
      event.result ??
      (FAILURE_ACTION_PATTERN.test(event.action) ? 'FAILURE' : 'SUCCESS');
    const reason = sanitizeAuditReason(event.reason ?? inferredReason);

    const client = this.prisma as unknown as AuditShape;
    await client.$transaction(async (tx) => {
      const [actor, subject] = await Promise.all([
        actorUuid
          ? tx.authenticationUser.findFirst({
              where: { uuid: actorUuid },
              select: { id: true, uuid: true },
            })
          : Promise.resolve(null),
        subjectUuid
          ? tx.authenticationUser.findFirst({
              where: { uuid: subjectUuid },
              select: { id: true, uuid: true },
            })
          : Promise.resolve(null),
      ]);
      let entityId: bigint | null = null;
      if (event.entityUuid && resourceType === 'role')
        entityId =
          (
            await tx.authorizationRole.findFirst({
              where: { uuid: event.entityUuid },
              select: { id: true, uuid: true },
            })
          )?.id ?? null;
      else if (event.entityUuid && resourceType === 'permission')
        entityId =
          (
            await tx.authorizationPermission.findFirst({
              where: { uuid: event.entityUuid },
              select: { id: true, uuid: true },
            })
          )?.id ?? null;
      const log = await tx.auditLog.create({
        data: {
          uuid: randomUUID(),
          actorUserId: actor?.id ?? null,
          userId: subject?.id ?? null,
          action: event.action,
          actorType,
          entityType: resourceType,
          entityId,
          resourceId: event.entityUuid ?? null,
          result,
          reason,
          ipAddress: safeIp,
          userAgent: safeUserAgent,
          requestId: safeRequestId,
        },
      });
      if (safeChanges.length > 0)
        await tx.auditLogChange.createMany({
          data: safeChanges.map((change) => ({
            auditLogId: log.id,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
          })),
        });
    });
  }

  private inferActorType(
    event: SecurityAuditEvent | AuditLogWriteEvent,
    resourceType: string | null,
    actorUuid: string | null,
  ): string {
    if (event.actorType) return event.actorType;
    if (resourceType && ADMIN_RESOURCE_TYPES.has(resourceType) && actorUuid)
      return 'USER';
    return 'SYSTEM';
  }

  async findMany(query: AuditLogListQuery): Promise<AuditLogListResult> {
    const client = this.prisma as unknown as AuditShape;
    const limit = Math.min(query.limit ?? 50, MAX_PAGE_SIZE);
    const page = Math.max(query.page ?? 1, 1);
    const records = await client.auditLog.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.result ? { result: query.result } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        actorUser: { select: { uuid: true } },
        subjectUser: { select: { uuid: true } },
        changes: {
          select: {
            id: true,
            field: true,
            oldValue: true,
            newValue: true,
          },
        },
      },
    });
    const total = await client.auditLog.count({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.result ? { result: query.result } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      },
    });
    return {
      items: records.map((record) => this.toEntity(record)),
      page,
      limit,
      total,
    };
  }

  private toEntity(record: AuditRecord): AuditLogEntity {
    const changes: AuditLogChangeEntityProps[] = record.changes.map(
      (change) => ({
        id: change.id,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      }),
    );
    return {
      uuid: record.uuid,
      action: record.action,
      actorType: record.actorType,
      actorUuid: record.actorUser?.uuid ?? null,
      subjectUuid: record.subjectUser?.uuid ?? null,
      entityType: record.entityType,
      resourceId: record.resourceId,
      result: record.result,
      reason: record.reason,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      requestId: record.requestId,
      createdAt: record.createdAt,
      changes,
    };
  }
}
