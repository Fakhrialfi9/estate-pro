import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';
import { PROPERTY_CAPABILITIES_REPOSITORY } from '../../../src/modules/property/domain/repositories/property-capabilities.repository.js';
import type { PropertyCapabilitiesRepository } from '../../../src/modules/property/domain/repositories/property-capabilities.repository.js';

let moduleRef: TestingModule;
let prisma: PrismaService;
let repository: PropertyCapabilitiesRepository;

const createdAmenityUuids = new Set<string>();
const createdPropertyUuids = new Set<string>();

async function createProperty(): Promise<{ uuid: string; id: bigint }> {
  const type = await prisma.propertyType.create({
    data: {
      uuid: randomUUID(),
      code: `CAP-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: 'Capability Type',
      slug: `capability-type-${randomUUID()}`,
    },
  });
  const category = await prisma.propertyCategory.create({
    data: {
      uuid: randomUUID(),
      propertyTypeId: type.id,
      code: `CAPCAT-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: 'Capability Category',
      slug: `capability-category-${randomUUID()}`,
    },
  });
  const property = await prisma.property.create({
    data: {
      uuid: randomUUID(),
      businessCode: `CAP-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
      referenceNumber: `CAP-${randomUUID()}`,
      propertyTypeId: type.id,
      propertyCategoryId: category.id,
      title: 'Capability Test Property',
      slug: `capability-property-${randomUUID()}`,
      status: 'ACTIVE',
      publishedAt: new Date(),
    },
  });
  createdPropertyUuids.add(property.uuid);
  return property;
}

describe('Property capabilities repository integration', () => {
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(PROPERTY_CAPABILITIES_REPOSITORY);
  });

  afterAll(async () => {
    for (const propertyUuid of createdPropertyUuids) {
      const property = await prisma.property.findUnique({
        where: { uuid: propertyUuid },
        select: { id: true },
      });
      if (property) {
        await prisma.propertyHistory.deleteMany({
          where: { propertyId: property.id },
        });
        const documents = await prisma.propertyDocument.findMany({
          where: { propertyId: property.id },
          select: { id: true },
        });
        if (documents.length)
          await prisma.propertyDocumentVersion.deleteMany({
            where: { documentId: { in: documents.map((row) => row.id) } },
          });
        await prisma.propertyDocument.deleteMany({
          where: { propertyId: property.id },
        });
        await prisma.propertyAmenityAssignment.deleteMany({
          where: { propertyId: property.id },
        });
        await prisma.property.delete({ where: { id: property.id } });
      }
    }
    for (const uuid of createdAmenityUuids)
      await prisma.propertyAmenity.delete({ where: { uuid } });
    await moduleRef.close();
  });

  it('persists and deactivates amenity taxonomy entries', async () => {
    const amenity = await repository.createAmenity({
      code: `INTEGRATION_${randomUUID().slice(0, 8).toUpperCase()}`,
      name: 'Integration Pool',
      category: 'RECREATION',
      sortOrder: 10,
    });
    createdAmenityUuids.add(amenity.uuid);
    expect(
      (await repository.listAmenities()).some(
        (item) => item.uuid === amenity.uuid,
      ),
    ).toBe(true);
    await repository.deleteAmenity(amenity.uuid);
    await expect(repository.getAmenity(amenity.uuid)).resolves.toMatchObject({
      uuid: amenity.uuid,
      isActive: false,
    });
  });

  it('enforces property amenity relation and supports idempotent assignment', async () => {
    const property = await createProperty();
    const amenity = await repository.createAmenity({
      code: `REL_${randomUUID().slice(0, 8).toUpperCase()}`,
      name: 'Parking',
      category: 'PARKING',
    });
    createdAmenityUuids.add(amenity.uuid);
    await repository.assignAmenity(property.uuid, amenity.uuid, {
      available: true,
      value: '2 spaces',
    });
    await repository.assignAmenity(property.uuid, amenity.uuid, {
      available: false,
      value: '2 spaces',
    });
    const assignments = await repository.listPropertyAmenities(property.uuid);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.available).toBe(false);
    await repository.unassignAmenity(property.uuid, amenity.uuid);
    expect(await repository.listPropertyAmenities(property.uuid)).toHaveLength(
      0,
    );
  });

  it('persists versioned document metadata without binary content', async () => {
    const property = await createProperty();
    const checksum = 'a'.repeat(64);
    const document = await repository.createDocument({
      propertyUuid: property.uuid,
      classification: 'LEGAL',
      title: 'Land deed',
      visibility: 'PRIVATE',
      status: 'ACTIVE',
      version: {
        storageProvider: 'object-storage',
        storageKey: `properties/${property.uuid}/land-deed.pdf`,
        mimeType: 'application/pdf',
        extension: 'pdf',
        fileSizeBytes: 1024,
        checksumSha256: checksum,
      },
    });
    expect(document.currentVersion).toBe(1);
    expect(document.versions[0]?.storageKey).toContain(property.uuid);
    const versioned = await repository.createDocumentVersion({
      propertyUuid: property.uuid,
      documentUuid: document.uuid,
      version: {
        storageProvider: 'object-storage',
        storageKey: `properties/${property.uuid}/land-deed-v2.pdf`,
        mimeType: 'application/pdf',
        extension: 'pdf',
        fileSizeBytes: 2048,
        checksumSha256: 'b'.repeat(64),
      },
    });
    expect(versioned.currentVersion).toBe(2);
    expect(versioned.versions).toHaveLength(2);
  });

  it('records immutable business history with deterministic pagination order', async () => {
    const property = await createProperty();
    await repository.recordHistory({
      propertyUuid: property.uuid,
      event: 'CREATED',
      summary: 'Property created',
    });
    await repository.recordHistory({
      propertyUuid: property.uuid,
      event: 'PRICE_CHANGED',
      summary: 'Price changed',
      changes: [{ field: 'askingPrice', oldValue: 10, newValue: 12 }],
    });
    const page = await repository.listHistory(property.uuid, 1, 1);
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.event).toBe('PRICE_CHANGED');
    expect(page.items[0]?.changes).toEqual([
      { field: 'askingPrice', oldValue: 10, newValue: 12 },
    ]);
  });
});
