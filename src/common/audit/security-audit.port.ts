export type AuditResult = 'SUCCESS' | 'FAILURE';
export type AuditActorType =
  'AUTHENTICATED' | 'ADMINISTRATIVE' | 'SYSTEM' | 'ANONYMOUS';

export interface SecurityAuditChange {
  field: string;
  oldValue: string | boolean | number | null;
  newValue: string | boolean | number | null;
}

export interface SecurityAuditEvent {
  action: string;
  userUuid?: string | undefined;
  actorUuid?: string | undefined;
  subjectUuid?: string | undefined;
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

export interface SecurityAuditRepository {
  record(event: SecurityAuditEvent): Promise<void>;
}

export const SECURITY_AUDIT_REPOSITORY = Symbol('SECURITY_AUDIT_REPOSITORY');
