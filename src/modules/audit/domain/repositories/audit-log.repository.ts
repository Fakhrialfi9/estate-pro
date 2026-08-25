import type {
  AuditActorType,
  AuditResult,
  SecurityAuditChange,
} from '../../../../common/audit/security-audit.port.js';
import type { AuditLogEntity } from '../entities/audit-log.entity.js';

export interface AuditLogListQuery {
  page: number;
  limit: number;
  actorUuid?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  result?: AuditResult;
  from?: Date;
  to?: Date;
}

export interface AuditLogListResult {
  items: AuditLogEntity[];
  total: number;
}

export interface AuditLogWriteEvent {
  action: string;
  actorUuid?: string;
  subjectUuid?: string;
  userUuid?: string;
  actorType?: AuditActorType;
  entityType?: string;
  entityUuid?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  result?: AuditResult;
  reason?: string;
  changes?: readonly SecurityAuditChange[];
  system?: boolean;
}

export interface AuditLogRepository {
  record(event: AuditLogWriteEvent): Promise<void>;
  list(query: AuditLogListQuery): Promise<AuditLogListResult>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
