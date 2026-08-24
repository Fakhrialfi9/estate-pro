import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller.js';
import {
  configuration,
  configurationValidationSchema,
} from './config/configuration.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { SENSITIVE_LOG_PATHS } from './common/constants/security.constants.js';

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
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.getOrThrow<string>('logging.level'),
          redact: {
            paths: [...SENSITIVE_LOG_PATHS],
            remove: true,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
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
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
