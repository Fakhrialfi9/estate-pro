import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import {
  PrismaListingRepository,
  ListingConflictError,
} from '../../src/modules/property/listing/infrastructure/listing.repository.js';

let moduleRef: TestingModule;
let prisma: PrismaService;
let repository: PrismaListingRepository;
let propertyUuid: string;
let listingUuid: string;
let listingVersion = 1;
let typeId: bigint;

async function createFixture(): Promise<void> {
  const type = await prisma.propertyType.create({
    data: {
      uuid: randomUUID(),
      code: `LT-${randomUUID().slice(0, 8)}`,
      name: 'Listing Integration Type',
      slug: `listing-type-${randomUUID()}`,
    },
  });
  typeId = type.id;
  const category = await prisma.propertyCategory.create({
    data: {
      uuid: randomUUID(),
      propertyTypeId: type.id,
      code: `LC-${randomUUID().slice(0, 8)}`,
      name: 'Listing Integration Category',
      slug: `listing-category-${randomUUID()}`,
    },
  });
  const property = await prisma.property.create({
    data: {
      uuid: randomUUID(),
      businessCode: `PROP-${randomUUID().slice(0, 10)}`,
      referenceNumber: `REF-${randomUUID()}`,
      propertyTypeId: type.id,
      propertyCategoryId: category.id,
      title: 'Listing Integration Property',
      slug: `listing-integration-${randomUUID()}`,
      status: 'DRAFT',
      availabilityStatus: 'AVAILABLE',
    },
  });
  propertyUuid = property.uuid;
}

async function cleanup(): Promise<void> {
  await prisma.propertyListing.deleteMany({
    where: { property: { propertyTypeId: typeId } },
  });
  await prisma.propertyAgentAssignment.deleteMany({
    where: { property: { propertyTypeId: typeId } },
  });
  await prisma.property.deleteMany({ where: { propertyTypeId: typeId } });
  await prisma.propertyCategory.deleteMany({
    where: { propertyTypeId: typeId },
  });
  await prisma.propertyType.deleteMany({ where: { id: typeId } });
}

describe('Property listing integration', () => {
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    repository = new PrismaListingRepository(prisma);
    await createFixture();
  });
  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  it('creates listing, separate price/payment rows and protects unique code', async () => {
    const code = `LIST-${randomUUID().slice(0, 8)}`;
    const result = await repository.create(
      {
        propertyUuid,
        listingCode: code,
        transactionType: 'SALE',
        price: {
          priceType: 'TOTAL',
          currency: 'IDR',
          minPrice: '1000000000.00',
          maxPrice: '1200000000.00',
        },
        payments: [
          {
            optionType: 'INSTALLMENT',
            downPaymentPercent: '20.00',
            installmentAmount: '40000000.00',
            tenorMonths: 24,
          },
        ],
      },
      { actorUuid: randomUUID() },
    );
    const data = result as { uuid: string; version: number; status: string };
    listingUuid = data.uuid;
    listingVersion = data.version;
    expect(data.status).toBe('DRAFT');
    const listing = await prisma.propertyListing.findUniqueOrThrow({
      where: { uuid: listingUuid },
      select: { id: true },
    });
    expect(
      await prisma.propertyListingPrice.findUnique({
        where: { listingId: listing.id },
      }),
    ).toMatchObject({ currency: 'IDR' });
    expect(
      await prisma.propertyListingPaymentOption.count({
        where: { listingId: listing.id },
      }),
    ).toBe(1);
    await expect(
      repository.create(
        { propertyUuid, listingCode: code, transactionType: 'SALE' },
        { actorUuid: randomUUID() },
      ),
    ).rejects.toBeInstanceOf(ListingConflictError);
  });

  it('runs review, verify, activate and publish with strict preconditions', async () => {
    await repository.assignAgent(
      propertyUuid,
      randomUUID(),
      'Integration Agent',
      true,
      { actorUuid: randomUUID() },
    );
    await repository.transition(listingUuid, listingVersion, 'IN_REVIEW', {
      actorUuid: randomUUID(),
    });
    listingVersion++;
    await repository.transition(listingUuid, listingVersion, 'VERIFIED', {
      actorUuid: randomUUID(),
    });
    listingVersion++;
    await prisma.property.update({
      where: { uuid: propertyUuid },
      data: { status: 'ACTIVE', version: { increment: 1 } },
    });
    await repository.transition(listingUuid, listingVersion, 'ACTIVE', {
      actorUuid: randomUUID(),
    });
    listingVersion++;
    const published = await repository.transition(
      listingUuid,
      listingVersion,
      'PUBLISHED',
      { actorUuid: randomUUID() },
    );
    listingVersion = (published as { version: number }).version;
    expect(published).toMatchObject({
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    });
    await expect(
      repository.transition(listingUuid, listingVersion - 1, 'UNPUBLISHED', {
        actorUuid: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(ListingConflictError);
  });

  it('provides bounded selective search/detail and a repeatable latency benchmark', async () => {
    const detail = await repository.getPropertyDetail(propertyUuid);
    expect(detail).toBeTruthy();
    const result = await repository.search({
      page: 1,
      limit: 100,
      search: 'Integration',
      transactionType: 'SALE',
      listingStatus: 'PUBLISHED',
      featured: false,
      verified: true,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    expect(result.limit).toBe(100);
    expect(result.items.length).toBeLessThanOrEqual(100);
    expect(result.total).toBeGreaterThanOrEqual(1);
    const durations: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const start = performance.now();
      await repository.search({
        page: 1,
        limit: 20,
        search: 'Listing Integration',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      });
      durations.push(performance.now() - start);
    }
    const sorted = [...durations].sort((a, b) => a - b);
    const p95 =
      sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
    expect(p95).toBeLessThan(500);
  });
});
