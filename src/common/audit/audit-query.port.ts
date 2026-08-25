import type { AuditResult, SecurityAuditChange } from './security-audit.port.js';

export interface AuditLogQuery {
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

export interface AuditLogView {
  uuid: string;
  actorUuid: string | null;
  actorType: string;
  subjectUuid: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: AuditResult;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
  changes: readonly AuditLogChange[];
}

export interface AuditLogQueryResult {
  items: readonly AuditLogView[];
  total: number;
}

export const AUDIT_QUERY_REPOSITORY = Symbol('AUDIT_QUERY_REPOSITORY');

export interface AuditQueryRepository {
  list(query: AuditLogQuery): Promise<AuditLogQueryResult>;
}
