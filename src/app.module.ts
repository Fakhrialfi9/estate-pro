import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { HealthModule } from './modules/health/health.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RolesModule } from './modules/roles/roles.module.js';

const shouldSkipThrottling = (context: ExecutionContext): boolean =>
  context.getClass() === HealthController;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configuration,
      validationSchema: configurationValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    LoggingModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.getOrThrow<number>('rateLimit.ttl'),
            limit: configService.getOrThrow<number>('rateLimit.limit'),
          },
          {
            name: 'login',
            ttl: configService.getOrThrow<number>('rateLimit.login.ttl'),
            limit: configService.getOrThrow<number>('rateLimit.login.limit'),
          },
        ],
        skipIf: shouldSkipThrottling,
      }),
    }),
    AuthModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
