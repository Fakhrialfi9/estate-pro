import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import databaseConfig from '../../../src/config/database.config.js';
import { DatabaseModule } from '../../../src/infrastructure/database/database.module.js';
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';
import { PrismaPropertyTypeRepository } from '../../../src/modules/property/infrastructure/persistence/prisma-property-type.repository.js';

describe('PropertyType persistence integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: PrismaPropertyTypeRepository;
  const createdTypeUuids = new Set<string>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: [databaseConfig],
        }),
        DatabaseModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    repository = new PrismaPropertyTypeRepository(prisma);
  });

  afterAll(async () => {
    if (createdTypeUuids.size > 0) {
      await prisma.propertyType.deleteMany({
        where: { uuid: { in: [...createdTypeUuids] } },
      });
    }
    await app.close();
  });

  const createTracked = async (
    input: Parameters<typeof repository.create>[0],
  ) => {
    const created = await repository.create(input);
    createdTypeUuids.add(created.uuid);
    return created;
  };

  const uniqueCode = (prefix: 'HOUSE' | 'VILLA'): string =>
    `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;

  const uniqueSlug = (prefix: 'house' | 'villa'): string =>
    `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 12).toLowerCase()}`;

  const data = (
    overrides: Partial<Parameters<typeof repository.create>[0]> = {},
  ) => ({
    code: uniqueCode('HOUSE'),
    name: 'House',
    slug: uniqueSlug('house'),
    description: 'Residential property',
    icon: 'house',
    isActive: true,
    sortOrder: 10,
    ...overrides,
  });

  it('creates and reads persisted records', async () => {
    const created = await createTracked(data());
    const found = await repository.findById(created.uuid);
    expect(found?.uuid).toBe(created.uuid);
    expect(found?.code).toBe(created.code);
    expect(found?.deletedAt).toBeNull();
  });

  it('lists with pagination, filtering and deterministic sorting', async () => {
    const token = randomUUID().replaceAll('-', '').slice(0, 12).toLowerCase();
    const houseCode = `HOUSE_${token.toUpperCase()}`;
    const houseSlug = `house-${token}`;
    const villaCode = `VILLA_${token.toUpperCase()}`;
    const villaSlug = `villa-${token}`;

    await createTracked(
      data({ code: houseCode, slug: houseSlug, sortOrder: 20 }),
    );
    await createTracked(
      data({
        code: villaCode,
        slug: villaSlug,
        sortOrder: 10,
      }),
    );

    const result = await repository.list({
      page: 1,
      limit: 1,
      filterField: 'isActive',
      filterValue: true,
      search: token,
      sortBy: 'sortOrder',
      sortDirection: 'asc',
    });
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.code).toBe(villaCode);
  });

  it('updates a persisted record', async () => {
    const created = await createTracked(data());
    const updated = await repository.update(created.uuid, {
      name: 'Town House',
      sortOrder: 25,
    });
    expect(updated.name).toBe('Town House');
    expect(updated.sortOrder).toBe(25);
  });

  it('enforces unique code and slug at the database boundary', async () => {
    const first = data({ code: 'DUPLICATE', slug: 'duplicate' });
    await createTracked(first);
    await expect(
      repository.create({ ...first, name: 'Second' }),
    ).rejects.toThrow('Property type code is already in use.');
    await expect(
      repository.create({ ...data(), slug: 'duplicate' }),
    ).rejects.toThrow('Property type slug is already in use.');
  });

  it('soft-deletes and excludes records from normal reads', async () => {
    const created = await createTracked(data());
    await repository.softDelete(created.uuid);
    expect(await repository.findById(created.uuid)).toBeNull();
    const result = await repository.list({
      page: 1,
      limit: 20,
      search: created.code,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });
    expect(result.total).toBe(0);
    const raw = await prisma.propertyType.findUniqueOrThrow({
      where: { uuid: created.uuid },
    });
    expect(raw.deletedAt).not.toBeNull();
    expect(raw.isActive).toBe(false);
  });
});
