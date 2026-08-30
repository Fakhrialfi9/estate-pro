import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { parseCanonicalDatabaseUrl } from '../../src/config/database-url.ts';

export type SeedTransaction = Prisma.TransactionClient;

export function createDatabaseClient(): PrismaClient {
  const database = parseCanonicalDatabaseUrl(process.env.DATABASE_URL);
  if (!database) throw new Error('DATABASE_URL is required for seeding');

  const adapter = new PrismaMariaDb({
    host: database.host,
    port: database.port,
    user: database.username,
    password: database.password,
    database: database.database,
    connectionLimit: Number(process.env.DATABASE_POOL_CONNECTION_LIMIT ?? 10),
    connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
  });

  return new PrismaClient({ adapter });
}
