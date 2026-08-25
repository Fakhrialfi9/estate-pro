export interface SecurityAuditChange {
  field: string;
  oldValue: string | boolean | number | null;
  newValue: string | boolean | number | null;
}

export interface SecurityAuditEvent {
  action: string;
  userUuid?: string;
  entityType?: string;
  entityUuid?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  changes?: readonly SecurityAuditChange[];
}

export interface SecurityAuditRepository {
  record(event: SecurityAuditEvent): Promise<void>;
}

export const SECURITY_AUDIT_REPOSITORY = Symbol('SECURITY_AUDIT_REPOSITORY');
