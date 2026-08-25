export interface SecurityAuditEvent {
  action: string;
  userUuid?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface SecurityAuditRepository {
  record(event: SecurityAuditEvent): Promise<void>;
}

export const SECURITY_AUDIT_REPOSITORY = Symbol('SECURITY_AUDIT_REPOSITORY');
