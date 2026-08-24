import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(configService.getOrThrow<string>('api.prefix'));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: configService.getOrThrow<string>('api.version'),
  });

  const host = configService.getOrThrow<string>('app.host');
  const port = configService.getOrThrow<number>('app.port');

  await app.listen(port, host);
}

void bootstrap();
