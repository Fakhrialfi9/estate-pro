import { Module } from '@nestjs/common';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { AuditLogsController } from './presentation/audit-logs.controller.js';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    PermissionsModule,
    AuthorizationModule,
  ],
  controllers: [AuditLogsController],
  providers: [AuthorizationGuard],
})
export class SystemModule {}
