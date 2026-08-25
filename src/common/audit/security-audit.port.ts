export interface SecurityAuditChange {
  field: string;
  oldValue: string | boolean | number | null;
  newValue: string | boolean | number | null;
}

export interface SecurityAuditEvent {
  action: string;
  userUuid?: string | undefined;
  entityType?: string | undefined;
  entityUuid?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
  changes?: readonly SecurityAuditChange[] | undefined;
}

export interface SecurityAuditRepository {
  record(event: SecurityAuditEvent): Promise<void>;
}

export const SECURITY_AUDIT_REPOSITORY = Symbol('SECURITY_AUDIT_REPOSITORY');
