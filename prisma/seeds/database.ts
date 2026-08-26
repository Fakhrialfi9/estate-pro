import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.ts';
import type { Prisma } from '../generated/prisma/client.ts';

export type SeedTransaction = Prisma.TransactionClient;

export function createDatabaseClient(): PrismaClient {
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER ?? 'dev',
    password: process.env.DATABASE_PASSWORD ?? 'dev123',
    database: process.env.DATABASE_NAME ?? 'estate_pro',
    connectionLimit: Number(process.env.DATABASE_POOL_CONNECTION_LIMIT ?? 10),
    connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
  });

  return new PrismaClient({ adapter });
}
