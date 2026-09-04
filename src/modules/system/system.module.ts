import { Module } from '@nestjs/common';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AutomationModule } from '../automation/automation.module.js';
import { AuditLogsController } from './presentation/audit-logs.controller.js';
import { SettingsController } from './presentation/settings.controller.js';
import { ActivityController } from './presentation/activity.controller.js';
import { NotificationsController } from './presentation/notifications.controller.js';
import { JobsController } from './presentation/jobs.controller.js';
import { SystemSettingsService } from './application/services/system-settings.service.js';
import { SystemActivityService } from './application/services/system-activity.service.js';
import { SystemNotificationService } from './application/services/system-notification.service.js';
import { SystemJobOperationsService } from './application/services/system-job-operations.service.js';
import { PrismaSystemSettingsRepository } from './infrastructure/persistence/prisma-system-settings.repository.js';
import { PrismaSystemActivityRepository } from './infrastructure/persistence/prisma-system-activity.repository.js';
import { SYSTEM_SETTINGS_REPOSITORY } from './domain/repositories/system-settings.repository.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from './domain/repositories/system-activity.repository.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, PermissionsModule, AuthorizationModule, AutomationModule],
  controllers: [AuditLogsController, SettingsController, ActivityController, NotificationsController, JobsController],
  providers: [
    AuthorizationGuard,
    SystemSettingsService,
    SystemActivityService,
    SystemNotificationService,
    SystemJobOperationsService,
    PrismaSystemSettingsRepository,
    PrismaSystemActivityRepository,
    { provide: SYSTEM_SETTINGS_REPOSITORY, useExisting: PrismaSystemSettingsRepository },
    { provide: SYSTEM_ACTIVITY_REPOSITORY, useExisting: PrismaSystemActivityRepository },
  ],
  exports: [SystemSettingsService, SystemActivityService],
})
export class SystemModule {}
