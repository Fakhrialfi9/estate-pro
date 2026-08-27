import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';

let moduleRef: TestingModule;
let prisma: PrismaService;

describe('Property master integration', () => {
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });
  afterAll(async () => moduleRef.close());

  it('exposes all master tables and critical foreign keys', async () => {
    const tables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT TABLE_NAME AS tableName FROM information_schema.tables
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('property_categories','property_subcategories','countries','provinces','cities','districts','subdistricts','facilities','properties','property_facilities')
    `;
    expect(new Set(tables.map((r) => r.tableName)).size).toBe(10);

    const fks = await prisma.$queryRaw<{ constraintName: string }[]>`
      SELECT CONSTRAINT_NAME AS constraintName FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('property_categories','property_subcategories','provinces','cities','districts','subdistricts','properties')
    `;
    expect(fks.length).toBeGreaterThanOrEqual(7);
  });

  it('supports real category hierarchy integrity', async () => {
    const type = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `IT-${randomUUID().slice(0, 8)}`,
        name: 'Integration Type',
        slug: `integration-${randomUUID()}`,
      },
    });
    const category = await prisma.propertyCategory.create({
      data: {
        uuid: randomUUID(),
        propertyTypeId: type.id,
        code: `CAT-${randomUUID().slice(0, 8)}`,
        name: 'Integration Category',
        slug: `integration-category-${randomUUID()}`,
      },
    });
    const subcategory = await prisma.propertySubcategory.create({
      data: {
        uuid: randomUUID(),
        propertyCategoryId: category.id,
        code: `SUB-${randomUUID().slice(0, 8)}`,
        name: 'Integration Subcategory',
        slug: `integration-subcategory-${randomUUID()}`,
      },
    });
    expect(subcategory.propertyCategoryId).toBe(category.id);
    await expect(
      prisma.propertyCategory.delete({ where: { id: category.id } }),
    ).rejects.toBeTruthy();
  });
});
