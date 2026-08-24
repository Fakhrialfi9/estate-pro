import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

describe('PrismaService lifecycle', () => {
  it('constructs from centralized database configuration and closes cleanly', async () => {
    const configService = new ConfigService({
      database: {
        host: '127.0.0.1',
        port: 3306,
        username: 'test',
        password: 'test-password',
        name: 'estate_pro_test',
        pool: {
          connectionLimit: 1,
          connectTimeoutMs: 100,
          acquireTimeoutMs: 100,
          idleTimeoutSec: 1,
        },
      },
    });

    const service = new PrismaService(configService);
    const connect = vi.spyOn(service, '$connect').mockResolvedValue(undefined);
    const disconnect = vi
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
