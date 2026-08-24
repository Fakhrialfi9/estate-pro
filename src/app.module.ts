import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { trace } from '@opentelemetry/api';

import { AppController } from './app.controller.js';
import {
  configuration,
  configurationValidationSchema,
} from './config/configuration.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { SENSITIVE_LOG_PATHS } from './common/constants/security.constants.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { HealthModule } from './modules/health/health.module.js';
import { ObservabilityModule } from './infrastructure/observability/observability.module.js';

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
          level: configService.get<boolean>('logging.enabled') === false
            ? 'silent'
            : configService.getOrThrow<string>('logging.level'),
          messageKey: 'message',
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const requestId =
              typeof incoming === 'string' &&
              incoming.length > 0 &&
              incoming.length <= 128 &&
              !/\s/.test(incoming)
                ? incoming
                : randomUUID();

            res.setHeader('X-Request-Id', requestId);
            return requestId;
          },
          customProps: (req) => {
            const spanContext = trace.getActiveSpan()?.spanContext();

            return {
              service: configService.getOrThrow<string>('app.name'),
              environment: configService.getOrThrow<string>('app.environment'),
              requestId: req.id,
              ...(spanContext?.traceId
                ? { traceId: spanContext.traceId, spanId: spanContext.spanId }
                : {}),
            };
          },
          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              userAgent: req.headers['user-agent'],
              remoteAddress: req.socket.remoteAddress,
            }),
            res: (res) => ({
              statusCode: res.statusCode,
            }),
          },
          customLogLevel: (req, res, err) => {
            if (err || res.statusCode >= 500) {
              return 'error';
            }
            if (res.statusCode >= 400) {
              return 'warn';
            }
            return 'info';
          },
          autoLogging: {
            ignore: (req) => req.url?.includes('/health/') ?? false,
          },
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
    HealthModule,
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [
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
