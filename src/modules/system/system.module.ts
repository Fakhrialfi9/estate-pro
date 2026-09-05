import { Module } from '@nestjs/common';
import {
  AUTOMATION_HEALTH_PORT,
  type AutomationHealthPort,
} from '../../common/contracts/automation-health.port.js';
import {
  SYSTEM_HEALTH_PORT,
  type SystemHealthPort,
} from '../../common/contracts/health-system.port.js';
import { AuthenticatedAccessGuard } from '../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AutomationModule } from '../automation/automation.module.js';
import { HealthModule } from '../health/health.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { SystemCacheModule } from './cache/system-cache.module.js';
import { AuditLogsController } from './presentation/audit-logs.controller.js';
import { ActivityController } from './presentation/activity.controller.js';
import { ExportController } from './presentation/export.controller.js';
import { ImportController } from './presentation/import.controller.js';
import { JobsController } from './presentation/jobs.controller.js';
import { NotificationsController } from './presentation/notifications.controller.js';
import { SettingsController } from './presentation/settings.controller.js';
import { WebhookController } from './presentation/webhook.controller.js';
import { IntegrationController } from './presentation/integration.controller.js';
import { OperationsController } from './presentation/operations.controller.js';
import { SystemRoadmapControlController } from './presentation/system-roadmap-control.controller.js';
import { IntegrationCallbackController } from './presentation/integration-callback.controller.js';
import { SystemActivityService } from './application/services/system-activity.service.js';
import { SystemExportService } from './application/services/system-export.service.js';
import { SystemImportService } from './application/services/system-import.service.js';
import { SystemImportMappingService } from './application/services/system-import-mapping.service.js';
import { SystemEnvironmentService } from './application/services/system-environment.service.js';
import { SystemIntegrationCallbackService } from './application/services/system-integration-callback.service.js';
import { SystemIntegrationCredentialService } from './application/services/system-integration-credential.service.js';
import { SystemIntegrationMappingService } from './application/services/system-integration-mapping.service.js';
import { SystemIntegrationReliabilityService } from './application/services/system-integration-reliability.service.js';
import { SystemIntegrationSyncService } from './application/services/system-integration-sync.service.js';
import { SystemOperationalAlertService } from './application/services/system-operational-alert.service.js';
import { SystemJobOperationsService } from './application/services/system-job-operations.service.js';
import { SystemNotificationService } from './application/services/system-notification.service.js';
import { SystemSettingsService } from './application/services/system-settings.service.js';
import { SystemWebhookService } from './application/services/system-webhook.service.js';
import { SystemIntegrationService } from './application/services/system-integration.service.js';
import { SystemOperationsService } from './application/services/system-operations.service.js';
import { SystemRoadmapControlService } from './application/services/system-roadmap-control.service.js';
import { SystemReadOnlyGuard } from './application/guards/system-read-only.guard.js';
import { PrismaSystemActivityRepository } from './infrastructure/persistence/prisma-system-activity.repository.js';
import { PrismaSystemExportRepository } from './infrastructure/persistence/prisma-system-export.repository.js';
import { PrismaSystemImportRepository } from './infrastructure/persistence/prisma-system-import.repository.js';
import { PrismaSystemSettingsRepository } from './infrastructure/persistence/prisma-system-settings.repository.js';
import { PrismaSystemWebhookRepository } from './infrastructure/persistence/prisma-system-webhook.repository.js';
import { PrismaSystemIntegrationRepository } from './infrastructure/persistence/prisma-system-integration.repository.js';
import { PrismaSystemRoadmapRepository } from './infrastructure/persistence/prisma-system-roadmap.repository.js';
import { PrismaSystemIntegrationOperationRetryRepository } from './infrastructure/persistence/prisma-system-integration-operation-retry.repository.js';
import { LocalSystemArtifactStorage } from './infrastructure/storage/local-system-artifact.storage.js';
import { SystemExportScheduler } from './infrastructure/export/system-export.scheduler.js';
import { SystemXlsxExporterAdapter } from './infrastructure/export/system-xlsx-exporter.adapter.js';
import { SystemMetricsService } from './infrastructure/observability/system-metrics.service.js';
import { WebhookNetworkService } from './infrastructure/webhook/webhook-network.service.js';
import { WebhookSecretService } from './infrastructure/webhook/webhook-secret.service.js';
import { WebhookSignerService } from './infrastructure/webhook/webhook-signer.service.js';
import { EnvironmentIntegrationSecretResolverService } from './infrastructure/integration/environment-integration-secret-resolver.service.js';
import { GenericHttpIntegrationProvider } from './infrastructure/integration/generic-http-integration.provider.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from './domain/repositories/system-activity.repository.js';
import { SYSTEM_ARTIFACT_STORAGE } from './domain/repositories/system-artifact.storage.js';
import { SYSTEM_EXPORT_REPOSITORY } from './domain/repositories/system-export.repository.js';
import { SYSTEM_IMPORT_REPOSITORY } from './domain/repositories/system-import.repository.js';
import { SYSTEM_SETTINGS_REPOSITORY } from './domain/repositories/system-settings.repository.js';
import { SYSTEM_WEBHOOK_REPOSITORY } from './domain/repositories/system-webhook.repository.js';
import { SYSTEM_INTEGRATION_REPOSITORY } from './domain/repositories/system-integration.repository.js';
import { SYSTEM_XLSX_EXPORTER } from './domain/repositories/system-xlsx-exporter.port.js';
import { SYSTEM_ROADMAP_REPOSITORY } from './domain/repositories/system-roadmap.repository.js';
import { SYSTEM_INTEGRATION_OPERATION_RETRY_REPOSITORY } from './domain/repositories/system-integration-operation-retry.repository.js';
import { SYSTEM_INTEGRATION_SECRET_RESOLVER } from './domain/integration/integration-secret-resolver.port.js';
import {
  SYSTEM_DATABASE_HEALTH_PORT,
  SYSTEM_JOB_HEALTH_PORT,
  SYSTEM_OPERATIONS_PORT,
  SYSTEM_STORAGE_HEALTH_PORT,
} from './domain/operations/system-operations.port.js';
import {
  SYSTEM_WEBHOOK_NETWORK_PORT,
  SYSTEM_WEBHOOK_SECRET_PORT,
  SYSTEM_WEBHOOK_SIGNER_PORT,
} from './domain/webhook/webhook.ports.js';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    AuthModule,
    PermissionsModule,
    AuthorizationModule,
    AutomationModule,
    HealthModule,
    SystemCacheModule,
  ],
  controllers: [
    AuditLogsController,
    ActivityController,
    ExportController,
    ImportController,
    JobsController,
    NotificationsController,
    SettingsController,
    WebhookController,
    IntegrationController,
    OperationsController,
    SystemRoadmapControlController,
    IntegrationCallbackController,
  ],
  providers: [
    AuthenticatedAccessGuard,
    AuthorizationGuard,
    SystemSettingsService,
    SystemActivityService,
    SystemNotificationService,
    SystemJobOperationsService,
    SystemImportService,
    SystemImportMappingService,
    SystemEnvironmentService,
    SystemIntegrationCallbackService,
    SystemIntegrationCredentialService,
    SystemIntegrationMappingService,
    SystemIntegrationReliabilityService,
    SystemIntegrationSyncService,
    SystemOperationalAlertService,
    SystemExportService,
    SystemExportScheduler,
    SystemXlsxExporterAdapter,
    SystemWebhookService,
    SystemIntegrationService,
    EnvironmentIntegrationSecretResolverService,
    GenericHttpIntegrationProvider,
    SystemOperationsService,
    SystemRoadmapControlService,
    SystemReadOnlyGuard,
    SystemMetricsService,
    PrismaSystemSettingsRepository,
    PrismaSystemActivityRepository,
    PrismaSystemImportRepository,
    PrismaSystemExportRepository,
    PrismaSystemWebhookRepository,
    PrismaSystemIntegrationRepository,
    PrismaSystemRoadmapRepository,
    PrismaSystemIntegrationOperationRetryRepository,
    LocalSystemArtifactStorage,
    WebhookNetworkService,
    WebhookSecretService,
    WebhookSignerService,
    {
      provide: SYSTEM_SETTINGS_REPOSITORY,
      useExisting: PrismaSystemSettingsRepository,
    },
    {
      provide: SYSTEM_ACTIVITY_REPOSITORY,
      useExisting: PrismaSystemActivityRepository,
    },
    {
      provide: SYSTEM_IMPORT_REPOSITORY,
      useExisting: PrismaSystemImportRepository,
    },
    {
      provide: SYSTEM_EXPORT_REPOSITORY,
      useExisting: PrismaSystemExportRepository,
    },
    {
      provide: SYSTEM_ARTIFACT_STORAGE,
      useExisting: LocalSystemArtifactStorage,
    },
    { provide: SYSTEM_XLSX_EXPORTER, useExisting: SystemXlsxExporterAdapter },
    {
      provide: SYSTEM_WEBHOOK_REPOSITORY,
      useExisting: PrismaSystemWebhookRepository,
    },
    {
      provide: SYSTEM_INTEGRATION_REPOSITORY,
      useExisting: PrismaSystemIntegrationRepository,
    },
    {
      provide: SYSTEM_ROADMAP_REPOSITORY,
      useExisting: PrismaSystemRoadmapRepository,
    },
    {
      provide: SYSTEM_INTEGRATION_OPERATION_RETRY_REPOSITORY,
      useExisting: PrismaSystemIntegrationOperationRetryRepository,
    },
    {
      provide: SYSTEM_INTEGRATION_SECRET_RESOLVER,
      useExisting: EnvironmentIntegrationSecretResolverService,
    },
    { provide: SYSTEM_WEBHOOK_SECRET_PORT, useExisting: WebhookSecretService },
    { provide: SYSTEM_WEBHOOK_SIGNER_PORT, useExisting: WebhookSignerService },
    {
      provide: SYSTEM_WEBHOOK_NETWORK_PORT,
      useExisting: WebhookNetworkService,
    },
    {
      provide: SYSTEM_STORAGE_HEALTH_PORT,
      useFactory: (storage: LocalSystemArtifactStorage) => ({
        check: async () => {
          try {
            await storage.health();
            return 'up' as const;
          } catch {
            return 'down' as const;
          }
        },
      }),
      inject: [LocalSystemArtifactStorage],
    },
    {
      provide: SYSTEM_JOB_HEALTH_PORT,
      useFactory: (automation: AutomationHealthPort) => automation,
      inject: [AUTOMATION_HEALTH_PORT],
    },
    {
      provide: SYSTEM_DATABASE_HEALTH_PORT,
      useFactory: (health: SystemHealthPort) => ({
        check: async (): Promise<'up' | 'down'> => {
          try {
            return await health.checkDatabase();
          } catch {
            return 'down';
          }
        },
      }),
      inject: [SYSTEM_HEALTH_PORT],
    },
    {
      provide: SYSTEM_OPERATIONS_PORT,
      useExisting: SystemOperationsService,
    },
    {
      provide: 'SYSTEM_INTEGRATION_PROVIDER_REGISTRATION',
      inject: [SystemIntegrationService, GenericHttpIntegrationProvider],
      useFactory: (
        integrations: SystemIntegrationService,
        provider: GenericHttpIntegrationProvider,
      ) => integrations.registerProvider(provider),
    },
  ],
  exports: [
    SystemSettingsService,
    SystemActivityService,
    SYSTEM_OPERATIONS_PORT,
    SystemRoadmapControlService,
    SystemIntegrationService,
    SystemIntegrationReliabilityService,
    SystemIntegrationSyncService,
    SystemIntegrationCredentialService,
    SystemOperationalAlertService,
  ],
})
export class SystemModule {}

export { SYSTEM_OPERATIONS_PORT } from './domain/operations/system-operations.port.js';
export type { SystemOperationsPort } from './domain/operations/system-operations.port.js';
