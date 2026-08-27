import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

type ExplainRow = {
  id: number;
  select_type: string;
  table: string;
  type: string;
  possible_keys: string | null;
  key: string | null;
  rows: number;
};

describe('Property critical query plans', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
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
    expect(plan[0]?.table).toBe('properties');
    expect(plan[0]?.possible_keys).toEqual(expect.any(String));
  });

  it('can explain the property location/filter query', async () => {
    const plan = await prisma.$queryRaw<ExplainRow[]>(
      Prisma.sql`EXPLAIN SELECT uuid, title, status, updated_at FROM properties WHERE deleted_at IS NULL AND property_type_id = 1 AND property_category_id = 1 ORDER BY updated_at DESC, id DESC LIMIT 20`,
    );

    expect(plan).toHaveLength(1);
    expect(plan[0]?.table).toBe('properties');
    expect(plan[0]?.possible_keys).toEqual(expect.any(String));
  });
});
