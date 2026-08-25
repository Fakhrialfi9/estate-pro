import type {
  AuditActorType,
  AuditResult,
  SecurityAuditChange,
} from '../../../../common/audit/security-audit.port.js';
import type { AuditLogEntity } from '../entities/audit-log.entity.js';

export interface AuditLogListQuery {
  page: number;
  limit: number;
  actorUuid?: string | undefined;
  action?: string | undefined;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  result?: AuditResult | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface AuditLogListResult {
  items: AuditLogEntity[];
  total: number;
}

export interface AuditLogWriteEvent {
  action: string;
  actorUuid?: string | undefined;
  subjectUuid?: string | undefined;
  userUuid?: string | undefined;
  actorType?: AuditActorType | undefined;
  entityType?: string | undefined;
  entityUuid?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
  result?: AuditResult | undefined;
  reason?: string | undefined;
  changes?: readonly SecurityAuditChange[] | undefined;
  system?: boolean | undefined;
}

export interface AuditLogRepository {
  record(event: AuditLogWriteEvent): Promise<void>;
  list(query: AuditLogListQuery): Promise<AuditLogListResult>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
