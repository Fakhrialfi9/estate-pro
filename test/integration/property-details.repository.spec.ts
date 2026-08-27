import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PROPERTY_DETAILS_REPOSITORY } from '../../src/modules/property/domain/repositories/property-details.repository.js';
import type { PropertyDetailsRepository } from '../../src/modules/property/domain/repositories/property-details.repository.js';
import { randomUUID } from 'node:crypto';

let prisma: PrismaService;
let repository: PropertyDetailsRepository;
let app: { close(): Promise<void> };
const actor = { actorUuid: randomUUID() };

async function createProperty() {
  const type = await prisma.propertyType.create({ data: { uuid: randomUUID(), code: `T-${randomUUID().slice(0, 10)}`, name: 'House', slug: `house-${randomUUID()}` } });
  const category = await prisma.propertyCategory.create({ data: { uuid: randomUUID(), propertyTypeId: type.id, code: `C-${randomUUID().slice(0, 10)}`, name: 'Residential', slug: `res-${randomUUID()}` } });
  return prisma.property.create({ data: {
    uuid: randomUUID(), businessCode: `B-${randomUUID().replaceAll('-', '').slice(0, 24)}`, referenceNumber: `R-${randomUUID()}`,
    propertyTypeId: type.id, propertyCategoryId: category.id, title: 'Integration Property', slug: `property-${randomUUID()}`,
  } });
}

async function createFacility(active = true) {
  return prisma.facility.create({ data: {
    uuid: randomUUID(), code: `FAC-${randomUUID().slice(0, 10)}`, name: 'Swimming Pool', slug: `facility-${randomUUID()}`,
    category: 'RECREATION', isActive: active,
  } });
}

describe('Property details repository integration', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const nest = moduleRef.createNestApplication();
    await nest.init();
    app = nest;
    prisma = app.get(PrismaService);
    repository = app.get(PROPERTY_DETAILS_REPOSITORY);
  });

  beforeEach(async () => {
    await prisma.propertyFacility.deleteMany();
    await prisma.propertyRoom.deleteMany();
    await prisma.propertyBuilding.deleteMany();
    await prisma.propertyLocation.deleteMany();
    await prisma.propertySpecification.deleteMany();
    await prisma.property.deleteMany();
    await prisma.facility.deleteMany();
    await prisma.propertyCategory.deleteMany();
    await prisma.propertyType.deleteMany();
  });

  afterAll(async () => app.close());

  it('upserts specification values and preserves decimal precision', async () => {
    const property = await createProperty();
    const saved = await repository.upsertSpecifications(property.uuid, {
      landArea: '12345.67', buildingArea: '4321.12', bedrooms: 4, bathrooms: '3.50', floors: 2,
      parkingType: 'GARAGE', parkingSpaces: 2, yearBuilt: 2020, yearRenovated: 2024,
    }, actor);
    expect(String((saved as { landArea: unknown }).landArea)).toBe('12345.67');
    expect(String((saved as { bathrooms: unknown }).bathrooms)).toBe('3.50');
  });

  it('blocks cross-property room access', async () => {
    const first = await createProperty();
    const second = await createProperty();
    const room = await repository.createRoom(first.uuid, { roomType: 'BEDROOM', name: 'Master', floor: 1, area: '20.50' }, actor);
    await expect(repository.updateRoom(second.uuid, (room as { uuid: string }).uuid, { name: 'Hijack' }, actor)).rejects.toThrow('Property room not found');
  });

  it('rolls back bulk facility attach when an inactive facility is included', async () => {
    const property = await createProperty();
    const active = await createFacility(true);
    const inactive = await createFacility(false);
    await expect(repository.bulkAttachFacilities(property.uuid, [{ facilityUuid: active.uuid }, { facilityUuid: inactive.uuid }], actor)).rejects.toThrow('inactive');
    const count = await prisma.propertyFacility.count({ where: { propertyId: property.id } });
    expect(count).toBe(0);
  });

  it('rejects duplicate facility assignment at the application boundary', async () => {
    const property = await createProperty();
    const facility = await createFacility(true);
    await repository.attachFacility(property.uuid, { facilityUuid: facility.uuid, quantity: 1 }, actor);
    await expect(repository.attachFacility(property.uuid, { facilityUuid: facility.uuid }, actor)).rejects.toThrow('already attached');
  });

  it('reorders only rooms belonging to the same property', async () => {
    const first = await createProperty();
    const second = await createProperty();
    const r1 = await repository.createRoom(first.uuid, { roomType: 'BEDROOM', name: 'A', floor: 1, area: '10' }, actor);
    const r2 = await repository.createRoom(first.uuid, { roomType: 'BEDROOM', name: 'B', floor: 1, area: '11' }, actor);
    const foreign = await repository.createRoom(second.uuid, { roomType: 'BEDROOM', name: 'Foreign', floor: 1, area: '12' }, actor);
    await expect(repository.reorderRooms(first.uuid, [(foreign as { uuid: string }).uuid, (r2 as { uuid: string }).uuid], actor)).rejects.toThrow('every active room');
    const rooms = await repository.listRooms(first.uuid);
    expect((rooms.find((room) => (room as { uuid: string }).uuid === (r1 as { uuid: string }).uuid) as { sortOrder: number }).sortOrder).toBe(0);
  });
});
