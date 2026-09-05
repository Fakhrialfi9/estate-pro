import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import {
  configuration,
  configurationValidationSchema,
} from './config/configuration.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { LoggingModule } from './infrastructure/logging/logger.module.js';
import { ObservabilityModule } from './infrastructure/observability/observability.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { PropertyModule } from './modules/property/property.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { PropertyMatchingModule } from './modules/property-matching/property-matching.module.js';
import { AutomationModule } from './modules/automation/automation.module.js';
import { AgentManagementModule } from './modules/agent-management/agent-management.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { SeoModule } from './modules/seo/seo.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configuration,
      validate: (env: Record<string, unknown>): Record<string, unknown> => {
        const result = configurationValidationSchema.validate(env, {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: { objects: true },
        });
        if (result.error) throw result.error;
        return result.value as Record<string, unknown>;
      },
    }),
    LoggingModule,
    DatabaseModule,
    ObservabilityModule,
    AuditModule,
    UsersModule,
    AuthModule,
    PermissionsModule,
    PropertyModule,
    RolesModule,
    SystemModule,
    ContentModule,
    CrmModule,
    SalesModule,
    AgentManagementModule,
    PropertyMatchingModule,
    AutomationModule,
    AnalyticsModule,
    SeoModule,
    DashboardModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    GlobalExceptionFilter,
    { provide: APP_FILTER, useExisting: GlobalExceptionFilter },
  ],
})
export class AppModule {}
