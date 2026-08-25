import type {
  AuditResult,
  SecurityAuditChange,
} from '../../../../common/audit/security-audit.port.js';

export interface AuditLogEntityProps {
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
  changes: readonly AuditLogChangeEntityProps[];
}

export interface AuditLogChangeEntityProps extends SecurityAuditChange {
  id?: string;
}

export class AuditLogEntity {
  constructor(public readonly props: AuditLogEntityProps) {}
}

export class AuditLogChangeEntity {
  constructor(public readonly props: AuditLogChangeEntityProps) {}
}
