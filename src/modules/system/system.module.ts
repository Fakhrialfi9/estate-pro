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
import { ImportController } from './presentation/import.controller.js';
import { ExportController } from './presentation/export.controller.js';
import { SystemSettingsService } from './application/services/system-settings.service.js';
import { SystemActivityService } from './application/services/system-activity.service.js';
import { SystemNotificationService } from './application/services/system-notification.service.js';
import { SystemJobOperationsService } from './application/services/system-job-operations.service.js';
import { SystemImportService } from './application/services/system-import.service.js';
import { SystemExportService } from './application/services/system-export.service.js';
import { PrismaSystemSettingsRepository } from './infrastructure/persistence/prisma-system-settings.repository.js';
import { PrismaSystemActivityRepository } from './infrastructure/persistence/prisma-system-activity.repository.js';
import { PrismaSystemImportRepository } from './infrastructure/persistence/prisma-system-import.repository.js';
import { PrismaSystemExportRepository } from './infrastructure/persistence/prisma-system-export.repository.js';
import { LocalSystemArtifactStorage } from './infrastructure/storage/local-system-artifact.storage.js';
import { SYSTEM_SETTINGS_REPOSITORY } from './domain/repositories/system-settings.repository.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from './domain/repositories/system-activity.repository.js';
import { SYSTEM_IMPORT_REPOSITORY } from './domain/repositories/system-import.repository.js';
import { SYSTEM_EXPORT_REPOSITORY } from './domain/repositories/system-export.repository.js';
import { SYSTEM_ARTIFACT_STORAGE } from './domain/repositories/system-artifact.storage.js';

@Module({
  imports:[DatabaseModule,AuditModule,AuthModule,PermissionsModule,AuthorizationModule,AutomationModule],
  controllers:[AuditLogsController,SettingsController,ActivityController,NotificationsController,JobsController,ImportController,ExportController],
  providers:[
    AuthorizationGuard,
    SystemSettingsService,SystemActivityService,SystemNotificationService,SystemJobOperationsService,SystemImportService,SystemExportService,
    PrismaSystemSettingsRepository,PrismaSystemActivityRepository,PrismaSystemImportRepository,PrismaSystemExportRepository,LocalSystemArtifactStorage,
    {provide:SYSTEM_SETTINGS_REPOSITORY,useExisting:PrismaSystemSettingsRepository},
    {provide:SYSTEM_ACTIVITY_REPOSITORY,useExisting:PrismaSystemActivityRepository},
    {provide:SYSTEM_IMPORT_REPOSITORY,useExisting:PrismaSystemImportRepository},
    {provide:SYSTEM_EXPORT_REPOSITORY,useExisting:PrismaSystemExportRepository},
    {provide:SYSTEM_ARTIFACT_STORAGE,useExisting:LocalSystemArtifactStorage},
  ],
  exports:[SystemSettingsService,SystemActivityService],
})
export class SystemModule {}
