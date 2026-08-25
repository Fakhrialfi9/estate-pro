import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import type { HelmetOptions } from 'helmet';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { SecureValidationPipe } from './common/pipes/secure-validation.pipe.js';

export const configureApplication = (app: NestExpressApplication): void => {
  const configService = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const trustProxy = configService.get<string | false>('security.trustProxy');
  if (trustProxy !== false) {
    app.set('trust proxy', trustProxy);
  }

  app.setGlobalPrefix(configService.getOrThrow<string>('api.prefix'));

  const configuredApiVersion = configService.getOrThrow<string>('api.version');
  const apiVersion = configuredApiVersion.replace(/^v/i, '');

  app.enableVersioning({
    type: 0,
    defaultVersion: apiVersion,
  });

  app.useGlobalPipes(
    new SecureValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  const helmetOptions =
    configService.getOrThrow<HelmetOptions>('security.helmet');
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
      threshold: configService.getOrThrow<string>(
        'security.compression.threshold',
      ),
    }),
  );
};

export const getApplicationAddress = (
  app: NestExpressApplication,
): { host: string; port: number } => {
  const configService = app.get(ConfigService);

  return {
    host: configService.getOrThrow<string>('app.host'),
    port: configService.getOrThrow<number>('app.port'),
  };
};
