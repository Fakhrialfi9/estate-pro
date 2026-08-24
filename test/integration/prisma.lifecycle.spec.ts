import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

describe('PrismaService lifecycle', () => {
  it('constructs from centralized database configuration and closes cleanly', async () => {
    const configService = {
      getOrThrow: vi.fn((key: string) => {
        const values: Record<string, unknown> = {
          'database.host': '127.0.0.1',
          'database.port': 3306,
          'database.username': 'test',
          'database.password': 'test-password',
          'database.name': 'estate_pro_test',
          'database.pool.connectionLimit': 1,
          'database.pool.connectTimeoutMs': 100,
          'database.pool.acquireTimeoutMs': 100,
          'database.pool.idleTimeoutSec': 1,
        };
        return values[key];
      }),
    };

    const service = new PrismaService(configService as never);
    const connect = vi.spyOn(service, '$connect').mockResolvedValue(undefined);
    const disconnect = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
