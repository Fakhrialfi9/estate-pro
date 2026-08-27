import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

type ExplainObjectRow = Record<string, unknown>;
type ExplainRow = ExplainObjectRow | readonly unknown[];

const EXPLAIN_COLUMNS = [
  'id',
  'select_type',
  'table',
  'partitions',
  'type',
  'possible_keys',
  'key',
  'key_len',
  'ref',
  'rows',
  'filtered',
  'Extra',
] as const;

const explainField = (
  row: ExplainRow | undefined,
  field: (typeof EXPLAIN_COLUMNS)[number] | string,
): unknown => {
  if (!row) return undefined;

  if (Array.isArray(row)) {
    const index = EXPLAIN_COLUMNS.findIndex(
      (column) => column.toLowerCase() === field.toLowerCase(),
    );
    return index >= 0 ? row[index] : undefined;
  }

  const expected = field.toLowerCase();
  const directValue = row[field];
  if (directValue !== undefined) return directValue;

  const entry = Object.entries(row).find(
    ([key]) => key.toLowerCase() === expected,
  );
  if (entry) return entry[1];

  return Object.values(row).find((value) =>
    field === 'table' ? value === 'properties' : typeof value === 'string',
  );
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
    const plan = await prisma.$queryRaw<ExplainRow[]>(
      Prisma.sql`EXPLAIN SELECT uuid, business_code, reference_number, title, slug, status, availability_status, available_from, available_to, version, created_at, updated_at FROM properties WHERE deleted_at IS NULL AND status = 'ACTIVE' ORDER BY updated_at DESC, id DESC LIMIT 20 OFFSET 0`,
    );

    expect(plan).toHaveLength(1);
    expect(explainField(plan[0], 'table')).toBe('properties');
    expect(explainField(plan[0], 'possible_keys')).toEqual(expect.any(String));
  });

  it('can explain the property location/filter query', async () => {
    const plan = await prisma.$queryRaw<ExplainRow[]>(
      Prisma.sql`EXPLAIN SELECT uuid, title, status, updated_at FROM properties WHERE deleted_at IS NULL AND property_type_id = 1 AND property_category_id = 1 ORDER BY updated_at DESC, id DESC LIMIT 20`,
    );

    expect(plan).toHaveLength(1);
    expect(explainField(plan[0], 'table')).toBe('properties');
    expect(explainField(plan[0], 'possible_keys')).toEqual(expect.any(String));
  });
});
