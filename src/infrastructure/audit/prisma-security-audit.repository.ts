import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma/prisma.service.js';
import type { Prisma } from '../../../prisma/generated/prisma/client.js';
import type {
  SecurityAuditRepository,
  SecurityAuditEvent,
} from '../../common/audit/security-audit.port.js';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../../common/audit/audit-events.js';
import {
  normalizeAuditResourceType,
  sanitizeAuditChanges,
  sanitizeAuditReason,
  sanitizeAuditRequestId,
  sanitizeAuditUserAgent,
} from '../../common/audit/audit-redaction.js';
import type { AuditLogChangeEntityProps } from '../../modules/audit/domain/entities/audit-log.entity.js';
import type {
  AuditLogListQuery,
  AuditLogListResult,
  AuditLogRepository,
} from '../../modules/audit/domain/repositories/audit-log.repository.js';

const MAX_PAGE_SIZE = 100;
const ALLOWED_ACTIONS = new Set<string>(Object.values(AUDIT_ACTIONS));
const FAILURE_ACTION_PATTERN = /(FAILURE|BLOCKED|ATTEMPTED)$/;
const ADMIN_RESOURCE_TYPES = new Set([
  'user',
  'role',
  'permission',
  'role_permission',
  'user_role',
]);

@Injectable()
export class PrismaSecurityAuditRepository
  implements SecurityAuditRepository, AuditLogRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async record(event: SecurityAuditEvent): Promise<void> {
    if (!ALLOWED_ACTIONS.has(event.action))
      throw new Error('Unsupported audit action');

    const resourceType = normalizeAuditResourceType(
      event.entityType ?? event.resourceType ?? 'authentication',
    );
    const entityUuid = event.entityUuid ?? event.resourceId;
    if (
      resourceType !== null &&
      !AUDIT_RESOURCE_TYPES.some((supported) => supported === resourceType)
    )
      throw new Error('Unsupported audit resource');

    const actorUuid = event.actorUuid ?? event.userUuid ?? null;
    const subjectUuid =
      event.subjectUuid ??
      (resourceType === 'authentication'
        ? (event.userUuid ?? actorUuid ?? null)
        : resourceType === 'user'
          ? (entityUuid ?? null)
          : null);
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
    const inferredReasonChange = event.changes?.find(
      (change) =>
        change.field === 'reason' && typeof change.newValue === 'string',
    );
    const inferredReason =
      typeof inferredReasonChange?.newValue === 'string'
        ? inferredReasonChange.newValue
        : undefined;
    const result =
      event.result ??
      (FAILURE_ACTION_PATTERN.test(event.action) ? 'FAILURE' : 'SUCCESS');
    const reason = sanitizeAuditReason(
      event.reason ?? event.metadata ?? inferredReason,
    );

    await this.prisma.$transaction(async (tx) => {
      const [actor, subject] = await Promise.all([
        actorUuid
          ? tx.authenticationUser.findFirst({
              where: { uuid: actorUuid },
              select: { id: true, uuid: true },
            })
          : null,
        subjectUuid
          ? tx.authenticationUser.findFirst({
              where: { uuid: subjectUuid },
              select: { id: true, uuid: true },
            })
          : null,
      ]);

      let entityId: bigint | null = null;
      if (entityUuid && resourceType === 'role') {
        entityId =
          (
            await tx.authorizationRole.findFirst({
              where: { uuid: entityUuid },
              select: { id: true, uuid: true },
            })
          )?.id ?? null;
      } else if (entityUuid && resourceType === 'permission') {
        entityId =
          (
            await tx.authorizationPermission.findFirst({
              where: { uuid: entityUuid },
              select: { id: true, uuid: true },
            })
          )?.id ?? null;
      }

      const log = await tx.auditLog.create({
        data: {
          uuid: randomUUID(),
          actorUserId: actor?.id ?? null,
          userId: subject?.id ?? null,
          action: event.action,
          actorType,
          entityType: resourceType,
          entityId,
          resourceId: entityUuid ?? null,
          result,
          reason,
          ipAddress: safeIp,
          userAgent: safeUserAgent,
          requestId: safeRequestId,
        },
      });

      if (safeChanges.length > 0) {
        await tx.auditLogChange.createMany({
          data: safeChanges.map((change) => ({
            auditLogId: log.id,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
          })),
        });
      }
    });
  }

  async list(query: AuditLogListQuery): Promise<AuditLogListResult> {
    const page = Math.max(1, query.page);
    const limit = Math.min(Math.max(1, query.limit), MAX_PAGE_SIZE);
    const resourceType = query.resourceType
      ? normalizeAuditResourceType(query.resourceType)
      : undefined;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorUuid) where.actor = { uuid: query.actorUuid };
    if (query.action) where.action = query.action;
    if (resourceType) where.entityType = resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.result) where.result = query.result;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          uuid: true,
          action: true,
          actorType: true,
          actor: { select: { uuid: true } },
          user: { select: { uuid: true } },
          entityType: true,
          resourceId: true,
          result: true,
          reason: true,
          ipAddress: true,
          userAgent: true,
          requestId: true,
          createdAt: true,
          changes: {
            orderBy: { id: 'asc' },
            select: { id: true, field: true, oldValue: true, newValue: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: records.map((record) => ({
        props: {
          uuid: record.uuid,
          actorUuid: record.actor?.uuid ?? null,
          actorType: record.actorType,
          subjectUuid: record.user?.uuid ?? null,
          action: record.action,
          resourceType: record.entityType,
          resourceId: record.resourceId,
          result: record.result === 'FAILURE' ? 'FAILURE' : 'SUCCESS',
          reason: sanitizeAuditReason(record.reason ?? undefined),
          ipAddress: record.ipAddress,
          userAgent: record.userAgent,
          requestId: record.requestId,
          createdAt: record.createdAt,
          changes: record.changes.map(
            (change): AuditLogChangeEntityProps => ({
              id: change.id.toString(),
              field: change.field,
              oldValue:
                typeof change.oldValue === 'string' ||
                typeof change.oldValue === 'boolean' ||
                typeof change.oldValue === 'number'
                  ? change.oldValue
                  : null,
              newValue:
                typeof change.newValue === 'string' ||
                typeof change.newValue === 'boolean' ||
                typeof change.newValue === 'number'
                  ? change.newValue
                  : null,
            }),
          ),
        },
      })),
      total,
    };
  }

  private inferActorType(
    event: SecurityAuditEvent,
    resourceType: string | null,
    actorUuid: string | null,
  ): 'AUTHENTICATED' | 'ADMINISTRATIVE' | 'SYSTEM' | 'ANONYMOUS' {
    if (!actorUuid) return event.system ? 'SYSTEM' : 'ANONYMOUS';
    if (event.actorUuid) return 'AUTHENTICATED';
    if (
      event.userUuid &&
      resourceType &&
      ADMIN_RESOURCE_TYPES.has(resourceType) &&
      !event.system
    )
      return 'ADMINISTRATIVE';
    return event.system ? 'SYSTEM' : 'AUTHENTICATED';
  }
}
