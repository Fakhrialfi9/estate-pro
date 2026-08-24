import './infrastructure/observability/telemetry.js';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import compression from 'compression';
import type { HelmetOptions } from 'helmet';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { startTelemetry } from './infrastructure/observability/telemetry.js';

async function bootstrap(): Promise<void> {
  startTelemetry();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const trustProxy = configService.get<string | false>('security.trustProxy');
  if (trustProxy !== false) {
    app.set('trust proxy', trustProxy);
  }

  app.setGlobalPrefix(configService.getOrThrow<string>('api.prefix'));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: configService.getOrThrow<string>('api.version'),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  const helmetOptions = configService.getOrThrow<HelmetOptions>('security.helmet');
  app.use(helmet(helmetOptions));

  app.enableCors({
    origin: configService.getOrThrow<string[]>('cors.origins'),
    methods: configService.getOrThrow<string[]>('cors.methods'),
    allowedHeaders: configService.getOrThrow<string[]>('cors.allowedHeaders'),
    exposedHeaders: configService.getOrThrow<string[]>('cors.exposedHeaders'),
    credentials: configService.getOrThrow<boolean>('cors.credentials'),
    maxAge: configService.getOrThrow<number>('cors.maxAge'),
  });

  const bodyLimit = configService.getOrThrow<string>('security.bodyLimit');
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', {
    extended: true,
    limit: bodyLimit,
  });

  app.use(
    compression({
      threshold: configService.getOrThrow<string>('security.compression.threshold'),
    }),
  );

  const host = configService.getOrThrow<string>('app.host');
  const port = configService.getOrThrow<number>('app.port');

  await app.listen(port, host);
}

void bootstrap();
