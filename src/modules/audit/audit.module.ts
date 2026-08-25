import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PrismaSecurityAuditRepository } from '../../infrastructure/audit/prisma-security-audit.repository.js';
import {
  AUDIT_QUERY_REPOSITORY,
  AuditQueryRepository,
} from '../../common/audit/audit-query.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../common/audit/security-audit.port.js';
import { AUDIT_LOG_REPOSITORY } from './domain/repositories/audit-log.repository.js';
import { AuditLogService } from './application/audit-log.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaSecurityAuditRepository,
    AuditLogService,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useExisting: PrismaSecurityAuditRepository,
    },
    { provide: SECURITY_AUDIT_REPOSITORY, useExisting: AuditLogService },
    { provide: AUDIT_QUERY_REPOSITORY, useExisting: AuditLogService },
  ],
  exports: [AUDIT_LOG_REPOSITORY, SECURITY_AUDIT_REPOSITORY, AUDIT_QUERY_REPOSITORY],
})
export class AuditModule {}

export type { AuditQueryRepository } from '../../common/audit/audit-query.port.js';
