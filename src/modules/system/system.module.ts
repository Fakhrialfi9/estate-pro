import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { AuditLogsController } from './presentation/audit-logs.controller.js';

@Module({
  imports: [AuditModule, AuthModule, PermissionsModule],
  controllers: [AuditLogsController],
})
export class SystemModule {}
