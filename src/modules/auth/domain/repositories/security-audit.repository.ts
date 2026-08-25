export interface SecurityAuditEvent {
  action: string;
  userUuid?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface SecurityAuditRepository {
  record(event: SecurityAuditEvent): Promise<void>;
}

export const SECURITY_AUDIT_REPOSITORY = Symbol('SECURITY_AUDIT_REPOSITORY');
