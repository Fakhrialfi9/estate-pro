import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

type JsonExplainRow = Record<string, unknown>;

type JsonExplainResult = {
  query_block?: Record<string, unknown>;
};

const readExplainJson = (row: JsonExplainRow | undefined): JsonExplainResult => {
  if (!row) {
    throw new Error('EXPLAIN FORMAT=JSON returned no result row.');
  }

  const rawValue = Object.values(row)[0];

  if (typeof rawValue !== 'string') {
    throw new Error('EXPLAIN FORMAT=JSON returned an unexpected result value.');
  }

  const parsed: unknown = JSON.parse(rawValue);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error('EXPLAIN FORMAT=JSON returned an invalid JSON document.');
  }

  return parsed as JsonExplainResult;
};

const containsPropertyTable = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(containsPropertyTable);
  }

  const record = value as Record<string, unknown>;

  if (record.table === 'properties' || record.table_name === 'properties') {
    return true;
  }

  return Object.values(record).some(containsPropertyTable);
};

const collectUsedKeys = (value: unknown, result: string[] = []): string[] => {
  if (typeof value !== 'object' || value === null) {
    return result;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUsedKeys(item, result);
    }
    return result;
  }

  const record = value as Record<string, unknown>;

  for (const [key, nestedValue] of Object.entries(record)) {
    if (
      key === 'key' ||
      key === 'possible_keys' ||
      key === 'possibleKeys' ||
      key === 'used_key' ||
      key === 'usedKey'
    ) {
      if (typeof nestedValue === 'string') {
        result.push(nestedValue);
      }

      if (Array.isArray(nestedValue)) {
        for (const item of nestedValue) {
          if (typeof item === 'string') {
            result.push(item);
          }
        }
      }
    }

    collectUsedKeys(nestedValue, result);
  }

  return result;
};

describe('Property critical query plans', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const config = new ConfigService({
      database: {
        host: process.env.DATABASE_HOST ?? '127.0.0.1',
        port: Number(process.env.DATABASE_PORT ?? 3306),
        username: process.env.DATABASE_USER ?? 'test',
        password: process.env.DATABASE_PASSWORD ?? 'test-password',
        name: process.env.DATABASE_NAME ?? 'estate_pro_test',
        pool: {
          connectionLimit: 2,
          connectTimeoutMs: 5000,
          acquireTimeoutMs: 10000,
          idleTimeoutSec: 30,
        },
      },
    });
    prisma = new PrismaService(config);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('can explain the indexed property listing query', async () => {
    const rows = await prisma.$queryRaw<JsonExplainRow[]>(
      Prisma.sql`EXPLAIN FORMAT=JSON SELECT uuid, business_code, reference_number, title, slug, status, availability_status, available_from, available_to, version, created_at, updated_at FROM properties WHERE deleted_at IS NULL AND status = 'ACTIVE' ORDER BY updated_at DESC, id DESC LIMIT 20 OFFSET 0`,
    );

    expect(rows).toHaveLength(1);

    const plan = readExplainJson(rows[0]);
    expect(containsPropertyTable(plan)).toBe(true);
    expect(collectUsedKeys(plan).length).toBeGreaterThanOrEqual(1);
  });

  it('can explain the property location/filter query', async () => {
    const rows = await prisma.$queryRaw<JsonExplainRow[]>(
      Prisma.sql`EXPLAIN FORMAT=JSON SELECT uuid, title, status, updated_at FROM properties WHERE deleted_at IS NULL AND property_type_id = 1 AND property_category_id = 1 ORDER BY updated_at DESC, id DESC LIMIT 20`,
    );

    expect(rows).toHaveLength(1);

    const plan = readExplainJson(rows[0]);
    expect(containsPropertyTable(plan)).toBe(true);
    expect(collectUsedKeys(plan).length).toBeGreaterThanOrEqual(1);
  });
});
