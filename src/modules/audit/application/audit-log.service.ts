import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_REPOSITORY } from '../domain/repositories/audit-log.repository.js';
import type {
  AuditLogListQuery,
  AuditLogListResult,
  AuditLogRepository,
  AuditLogWriteEvent,
} from '../domain/repositories/audit-log.repository.js';
import type {
  SecurityAuditRepository,
  SecurityAuditEvent,
} from '../../../common/audit/security-audit.port.js';
import {
  sanitizeAuditChanges,
  sanitizeAuditReason,
} from '../../../common/audit/audit-redaction.js';

@Injectable()
export class AuditLogService implements SecurityAuditRepository {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repository: AuditLogRepository,
  ) {}

  async record(event: SecurityAuditEvent): Promise<void> {
    const resourceType = event.entityType ?? null;
    const safeChanges = sanitizeAuditChanges(
      resourceType ?? 'authentication',
      event.changes,
    );
    const safeReason =
      event.reason !== undefined
        ? sanitizeAuditReason(event.reason)
        : null;
    const writeEvent: AuditLogWriteEvent = {
      action: event.action,
      ...(event.actorUuid !== undefined ? { actorUuid: event.actorUuid } : {}),
      ...(event.userUuid !== undefined ? { userUuid: event.userUuid } : {}),
      ...(event.subjectUuid !== undefined
        ? { subjectUuid: event.subjectUuid }
        : {}),
      ...(event.actorType !== undefined ? { actorType: event.actorType } : {}),
      ...(event.entityType !== undefined
        ? { entityType: event.entityType }
        : {}),
      ...(event.entityUuid !== undefined
        ? { entityUuid: event.entityUuid }
        : {}),
      ...(event.ipAddress !== undefined ? { ipAddress: event.ipAddress } : {}),
      ...(event.userAgent !== undefined ? { userAgent: event.userAgent } : {}),
      ...(event.requestId !== undefined ? { requestId: event.requestId } : {}),
      ...(event.result !== undefined ? { result: event.result } : {}),
      ...(safeReason !== null ? { reason: safeReason } : {}),
      ...(safeChanges.length > 0 ? { changes: safeChanges } : {}),
      ...(event.system !== undefined ? { system: event.system } : {}),
    };
    await this.repository.record(writeEvent);
  }

  list(query: AuditLogListQuery): Promise<AuditLogListResult> {
    return this.repository.list(query);
  }
}
