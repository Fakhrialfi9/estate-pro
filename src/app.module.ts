import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configuration,
      validationSchema: configurationValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    LoggingModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        skipIf: (context) => {
          const request = context
            .switchToHttp()
            .getRequest<{ path?: string }>();

          return request.path?.startsWith('/api/v1/health/') ?? false;
        },
        getTracker: (request) =>
          request.ip ?? request.socket?.remoteAddress ?? 'unknown',
        throttlers: [
          {
            ttl: configService.getOrThrow<number>('rateLimit.ttl'),
            limit: configService.getOrThrow<number>('rateLimit.limit'),
          },
        ],
      }),
    }),
    AuthModule,
    DatabaseModule,
    HealthModule,
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
