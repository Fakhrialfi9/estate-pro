import { Module } from '@nestjs/common';
import { LoggerModule as NestPinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { trace } from '@opentelemetry/api';

import { SENSITIVE_LOG_PATHS } from '../../common/constants/security.constants.js';
import { getConfiguredLogLevel } from './logger.config.js';

@Module({
  imports: [
    NestPinoLoggerModule.forRoot({
      pinoHttp: {
        level: getConfiguredLogLevel(),
        messageKey: 'message',
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
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
        customProps: (req: IncomingMessage) => {
          const spanContext = trace.getActiveSpan()?.spanContext();

          return {
            service: process.env.APP_NAME ?? 'estate-pro-api',
            environment: process.env.NODE_ENV ?? 'development',
            requestId: req.id,
            ...(spanContext?.traceId
              ? { traceId: spanContext.traceId, spanId: spanContext.spanId }
              : {}),
          };
        },
        serializers: {
          req: (req: IncomingMessage) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
            remoteAddress: req.socket.remoteAddress,
          }),
          res: (res: ServerResponse) => ({
            statusCode: res.statusCode,
          }),
        },
        customLogLevel: (
          _req: IncomingMessage,
          res: ServerResponse,
          err?: Error,
        ) => {
          if (err || res.statusCode >= 500) {
            return 'error';
          }
          if (res.statusCode >= 400) {
            return 'warn';
          }
          return 'info';
        },
        autoLogging: {
          ignore: (req: IncomingMessage) =>
            req.url?.includes('/health/') ?? false,
        },
        redact: {
          paths: [...SENSITIVE_LOG_PATHS],
          remove: true,
        },
      },
    }),
  ],
  exports: [NestPinoLoggerModule],
})
export class LoggingModule {}
