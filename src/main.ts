import './infrastructure/observability/telemetry.js';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import {
  configureApplication,
  configureSwagger,
  getApplicationAddress,
} from './bootstrap.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    rawBody: true,
    bufferLogs: true,
  });

  configureApplication(app);
  configureSwagger(app);

  const { host, port } = getApplicationAddress(app);
  await app.listen(port, host);
}

void bootstrap();
