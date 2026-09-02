import { randomUUID } from 'node:crypto';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { HelmetOptions } from 'helmet';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { SecureValidationPipe } from './common/pipes/secure-validation.pipe.js';
import { applyContentOpenApiContract } from './common/swagger/content-openapi-contract.js';
import { applyOpenApiContract } from './common/swagger/openapi-contract.js';
import {
  LOGIN_RATE_LIMIT,
  REFRESH_RATE_LIMIT,
  SECURITY_SESSION_RATE_LIMIT,
  TWO_FACTOR_ENROLLMENT_RATE_LIMIT,
  TWO_FACTOR_RECOVERY_REGENERATION_RATE_LIMIT,
  TWO_FACTOR_REAUTH_RATE_LIMIT,
  TWO_FACTOR_VERIFICATION_RATE_LIMIT,
} from './config/rate-limit.config.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

type RateLimitPolicy = Readonly<{
  ttl: number;
  limit: number;
}>;

const createRateLimiter = (policy: RateLimitPolicy) =>
  rateLimit({
    windowMs: policy.ttl,
    limit: policy.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

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
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    const raw = request.header('x-request-id');
    const requestId = raw && REQUEST_ID_PATTERN.test(raw) ? raw : randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);
    next();
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

  const apiBase = `/${configService.getOrThrow<string>('api.prefix')}/${apiVersion}`;
  const loginPath = `${apiBase}/auth/login`;
  const refreshPath = `${apiBase}/auth/refresh`;
  const twoFactorBasePath = `${apiBase}/auth/2fa`;
  const sessionBasePath = `${apiBase}/auth/sessions`;
  const adminSessionBasePath = `${apiBase}/admin/session-management`;

  app.use(loginPath, createRateLimiter(LOGIN_RATE_LIMIT));
  app.use(refreshPath, createRateLimiter(REFRESH_RATE_LIMIT));
  app.use(
    `${twoFactorBasePath}/enrollment`,
    createRateLimiter(TWO_FACTOR_ENROLLMENT_RATE_LIMIT),
  );
  app.use(
    `${twoFactorBasePath}/enrollment/verify`,
    createRateLimiter(TWO_FACTOR_ENROLLMENT_RATE_LIMIT),
  );
  app.use(
    `${twoFactorBasePath}/verify`,
    createRateLimiter(TWO_FACTOR_VERIFICATION_RATE_LIMIT),
  );
  app.use(
    `${twoFactorBasePath}/recovery-codes/regenerate`,
    createRateLimiter(TWO_FACTOR_RECOVERY_REGENERATION_RATE_LIMIT),
  );
  app.use(
    `${twoFactorBasePath}/disable`,
    createRateLimiter(TWO_FACTOR_REAUTH_RATE_LIMIT),
  );
  app.use(sessionBasePath, createRateLimiter(SECURITY_SESSION_RATE_LIMIT));
  app.use(
    adminSessionBasePath,
    createRateLimiter(SECURITY_SESSION_RATE_LIMIT),
  );

  const globalPolicy = {
    ttl: configService.getOrThrow<number>('rateLimit.ttl'),
    limit: configService.getOrThrow<number>('rateLimit.limit'),
  } satisfies RateLimitPolicy;
  const excludedPrefix = [
    loginPath,
    refreshPath,
    twoFactorBasePath,
    sessionBasePath,
    adminSessionBasePath,
  ];
  const globalRateLimiter = rateLimit({
    windowMs: globalPolicy.ttl,
    limit: globalPolicy.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (request) =>
      request.path === `${apiBase}/health/live` ||
      request.path === `${apiBase}/health/ready` ||
      excludedPrefix.some(
        (prefix) =>
          request.path === prefix || request.path.startsWith(`${prefix}/`),
      ),
  });
  app.use(globalRateLimiter);
};

export const configureSwagger = (app: NestExpressApplication): void => {
  const configService = app.get(ConfigService);
  const swaggerEnabled =
    configService.get<boolean>('api.swaggerEnabled') ?? false;

  if (!swaggerEnabled) {
    return;
  }

  const apiVersion = configService.getOrThrow<string>('api.version');
  const apiPrefix = configService.getOrThrow<string>('api.prefix');
  const appVersion = configService.getOrThrow<string>('app.version');
  const appName = configService.getOrThrow<string>('app.name');

  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${appName} API`)
    .setDescription(
      `Estate Pro HTTP API (${apiPrefix}/${apiVersion}). OpenAPI describes the public API contract; runtime validation, serialization, authentication, authorization, and error behavior remain authoritative.`,
    )
    .setVersion(appVersion)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by POST /api/v1/auth/login.',
      },
      'bearer',
    )
    .build();

  const document = applyContentOpenApiContract(
    applyOpenApiContract(
      SwaggerModule.createDocument(app, swaggerConfig),
      configService,
    ),
  );

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    swaggerOptions: {
      persistAuthorization: false,
    },
  });
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
