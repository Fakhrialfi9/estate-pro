import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const adapter = new PrismaMariaDb({
      host: configService.getOrThrow<string>('database.host'),
      port: configService.getOrThrow<number>('database.port'),
      user: configService.getOrThrow<string>('database.username'),
      password: configService.getOrThrow<string>('database.password'),
      database: configService.getOrThrow<string>('database.name'),
      connectionLimit: configService.getOrThrow<number>(
        'database.pool.connectionLimit',
      ),
      connectTimeout: configService.getOrThrow<number>(
        'database.pool.connectTimeoutMs',
      ),
      acquireTimeout: configService.getOrThrow<number>(
        'database.pool.acquireTimeoutMs',
      ),
      idleTimeout: configService.getOrThrow<number>(
        'database.pool.idleTimeoutSec',
      ),
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
