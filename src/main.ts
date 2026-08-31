import './infrastructure/observability/telemetry.js';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { configureApplication, getApplicationAddress } from './bootstrap.js';
import { applyOpenApiContract } from './common/swagger/openapi-contract.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  configureApplication(app);

  const configService = app.get(ConfigService);
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

  const document = applyOpenApiContract(
    SwaggerModule.createDocument(app, swaggerConfig),
    configService,
  );

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    swaggerOptions: {
      persistAuthorization: false,
    },
  });

  const { host, port } = getApplicationAddress(app);
  await app.listen(port, host);
}

void bootstrap();
