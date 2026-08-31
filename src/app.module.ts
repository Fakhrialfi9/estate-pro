import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
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
import { HealthController } from './modules/health/health.controller.js';
import { HealthModule } from './modules/health/health.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { PropertyModule } from './modules/property/property.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { ContentModule } from './modules/content/content.module.js';

const shouldSkipThrottling = (context: ExecutionContext): boolean =>
  context.getClass() === HealthController;
const validateEnvironment = (
  env: Record<string, unknown>,
): Record<string, unknown> => {
  const result = configurationValidationSchema.validate(env, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: { objects: true },
  });
  if (result.error) throw result.error;
  return result.value as Record<string, unknown>;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configuration,
      validate: validateEnvironment,
      validationOptions: { abortEarly: false, allowUnknown: false },
    }),
    LoggingModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        skipIf: shouldSkipThrottling,
        throttlers: [
          {
            name: 'default',
            ttl: configService.getOrThrow<number>('rateLimit.ttl'),
            limit: configService.getOrThrow<number>('rateLimit.limit'),
          },
        ],
      }),
    }),
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
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    GlobalExceptionFilter,
    { provide: APP_FILTER, useExisting: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
