import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PropertyDetailsService } from '../../../src/modules/property/application/property-details.service.js';
import { PropertyMasterService } from '../../../src/modules/property/application/property-master.service.js';
import { PropertyLifecycleService } from '../../../src/modules/property/application/property-lifecycle.service.js';
import { ListPropertyTypesUseCase } from '../../../src/modules/property/application/use-cases/list-property-types.use-case.js';
import { DeletePropertyTypeUseCase } from '../../../src/modules/property/application/use-cases/delete-property-type.use-case.js';
import { ListingService } from '../../../src/modules/property/listing/application/listing.service.js';
import { ListingExpiryWorker } from '../../../src/modules/property/listing/application/listing-expiry.worker.js';
import { PropertyTypeEntity } from '../../../src/modules/property/domain/entities/property-type.entity.js';
import {
  MasterConcurrencyError,
  MasterConflictError,
  MasterHierarchyError,
  MasterInUseError,
  MasterStateError,
} from '../../../src/modules/property/domain/errors.js';
import {
  ListingConflictError,
  ListingNotFoundError,
  ListingStateError,
  ListingValidationError,
} from '../../../src/modules/property/listing/infrastructure/listing.repository.js';
import {
  PropertyDetailConflictError,
  PropertyDetailInvalidStateError,
  PropertyDetailNotFoundError,
} from '../../../src/modules/property/domain/property-details.js';
import {
  hashSensitive,
  maskSensitive,
  validateCertificateDates,
  validateCertificateInput,
  validateFinancialInvariants,
  validateLegalInvariants,
  validateMedia,
  validateSeoInvariants,
  validateUtilityInvariants,
} from '../../../src/modules/property/domain/property-extras.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';
import type { PropertyDetailsRepository } from '../../../src/modules/property/domain/repositories/property-details.repository.js';
import type { PropertyMasterRepository } from '../../../src/modules/property/domain/repositories/property-master.repository.js';
import type { PropertyLifecycleRepository } from '../../../src/modules/property/domain/repositories/property-lifecycle.repository.js';
import type { ListingRepository } from '../../../src/modules/property/listing/domain/listing.repository.js';
import type { ActorContext } from '../../../src/modules/property/domain/property-master.types.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const uuid2 = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-01-01T00:00:00.000Z');
const actor: ActorContext = {
  actorUuid: uuid,
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const namedMasterError = (name: string, message = name): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const detailRepository = () =>
  ({
    getSpecifications: vi.fn().mockResolvedValue({ bedrooms: 3 }),
    upsertSpecifications: vi.fn().mockResolvedValue({ bedrooms: 4 }),
    getLocation: vi.fn().mockResolvedValue({ city: 'Jakarta' }),
    updateLocation: vi.fn().mockResolvedValue({ city: 'Bandung' }),
    getBuilding: vi.fn().mockResolvedValue({ floor: 2 }),
    updateBuilding: vi.fn().mockResolvedValue({ floor: 3 }),
    listRooms: vi.fn().mockResolvedValue([]),
    createRoom: vi.fn().mockResolvedValue({ uuid: uuid2 }),
    updateRoom: vi.fn().mockResolvedValue({ uuid: uuid2 }),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    reorderRooms: vi.fn().mockResolvedValue([]),
    listPropertyFacilities: vi.fn().mockResolvedValue([]),
    attachFacility: vi.fn().mockResolvedValue({ uuid: uuid2 }),
    updateFacilityAssignment: vi.fn().mockResolvedValue({ uuid: uuid2 }),
    detachFacility: vi.fn().mockResolvedValue(undefined),
    bulkAttachFacilities: vi.fn().mockResolvedValue([]),
  }) satisfies PropertyDetailsRepository;

const audit = {
  record: vi
    .fn<SecurityAuditRepository['record']>()
    .mockResolvedValue(undefined),
} satisfies SecurityAuditRepository;

describe('property phase 10 coverage', () => {
  it('covers property details success, audit and repository error mapping', async () => {
    const repository = detailRepository();
    const service = new PropertyDetailsService(repository, audit);
    await service.getSpecifications(uuid);
    await service.updateSpecifications(uuid, { bedrooms: 4 }, actor);
    await service.getLocation(uuid);
    await service.updateLocation(uuid, { cityUuid: uuid }, actor);
    await service.getBuilding(uuid);
    await service.updateBuilding(uuid, { yearBuilt: 2020 }, actor);
    await service.listRooms(uuid);
    await service.createRoom(
      uuid,
      { roomType: 'BEDROOM', floor: 1 } as never,
      actor,
    );
    await service.updateRoom(uuid, uuid2, { notes: 'updated' } as never, actor);
    await service.deleteRoom(uuid, uuid2, actor);
    await service.reorderRooms(uuid, [uuid2], actor);
    await service.listPropertyFacilities(uuid);
    await service.attachFacility(uuid, { facilityUuid: uuid2 }, actor);
    await service.updateFacility(uuid, uuid2, { notes: 'n' }, actor);
    await service.detachFacility(uuid, uuid2, actor);
    await service.bulkAttachFacilities(uuid, [uuid2], actor);
    await expect(
      service.reorderRooms(uuid, [uuid2, uuid2], actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.bulkAttachFacilities(uuid, [uuid2, uuid2], actor),
    ).rejects.toBeInstanceOf(BadRequestException);

    const errorCases: Array<[Error, new (...args: never[]) => Error]> = [
      [new PropertyDetailNotFoundError(), NotFoundException],
      [new PropertyDetailConflictError(), ConflictException],
      [new PropertyDetailInvalidStateError(), BadRequestException],
    ];
    for (const [error, expected] of errorCases) {
      repository.getSpecifications.mockRejectedValueOnce(error);
      await expect(service.getSpecifications(uuid)).rejects.toBeInstanceOf(
        expected,
      );
    }
    repository.getSpecifications.mockRejectedValueOnce({
      name: 'PropertyDetailNotFoundError',
      message: 'named missing',
    });
    await expect(service.getSpecifications(uuid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    repository.getSpecifications.mockRejectedValueOnce({
      name: 'PropertyDetailConflictError',
      message: 'named conflict',
    });
    await expect(service.getSpecifications(uuid)).rejects.toBeInstanceOf(
      ConflictException,
    );
    repository.getSpecifications.mockRejectedValueOnce({
      name: 'PropertyDetailInvalidStateError',
      message: 'named state',
    });
    await expect(service.getSpecifications(uuid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    repository.getSpecifications.mockRejectedValueOnce(new Error('unexpected'));
    await expect(service.getSpecifications(uuid)).rejects.toThrow('unexpected');
  });

  it('covers property master lifecycle and all mapping branches', async () => {
    const repository = {
      createCategory: vi.fn().mockResolvedValue({ uuid }),
      updateCategory: vi.fn().mockResolvedValue({ uuid }),
      getCategory: vi.fn().mockResolvedValue({ uuid }),
      listCategories: vi.fn().mockResolvedValue([]),
      deleteCategory: vi.fn().mockResolvedValue(undefined),
      createSubcategory: vi.fn().mockResolvedValue({ uuid }),
      updateSubcategory: vi.fn().mockResolvedValue({ uuid }),
      getSubcategory: vi.fn().mockResolvedValue({ uuid }),
      listSubcategories: vi.fn().mockResolvedValue([]),
      deleteSubcategory: vi.fn().mockResolvedValue(undefined),
      createLocation: vi.fn().mockResolvedValue({ uuid }),
      updateLocation: vi.fn().mockResolvedValue({ uuid }),
      getLocation: vi.fn().mockResolvedValue({ uuid }),
      listLocations: vi.fn().mockResolvedValue([]),
      deleteLocation: vi.fn().mockResolvedValue(undefined),
      children: vi.fn().mockResolvedValue([]),
      createFacility: vi.fn().mockResolvedValue({ uuid }),
      updateFacility: vi.fn().mockResolvedValue({ uuid }),
      getFacility: vi.fn().mockResolvedValue({ uuid }),
      listFacilities: vi.fn().mockResolvedValue([]),
      deleteFacility: vi.fn().mockResolvedValue(undefined),
      createProperty: vi
        .fn()
        .mockResolvedValue({ uuid, title: 'House', status: 'DRAFT' }),
      getProperty: vi.fn().mockResolvedValue({
        uuid,
        status: 'DRAFT',
        availableFrom: null,
        availableTo: null,
      }),
      listProperties: vi.fn().mockResolvedValue([]),
      updateProperty: vi.fn().mockResolvedValue({
        uuid,
        status: 'DRAFT',
        title: 'Updated',
        version: 2,
      }),
      deleteProperty: vi.fn().mockResolvedValue(undefined),
      restoreProperty: vi.fn().mockResolvedValue({ uuid }),
      duplicateProperty: vi.fn().mockResolvedValue({ uuid: uuid2 }),
    } satisfies PropertyMasterRepository;
    const service = new PropertyMasterService(repository, audit);

    await service.createCategory(
      { typeUuid: uuid, code: 'RES', name: 'Residential' },
      actor,
    );
    await service.updateCategory(uuid, undefined, {}, actor);
    await service.getCategory(uuid);
    await service.listCategories({ page: 1, limit: 10 });
    await service.deleteCategory(uuid, actor);
    await service.createSubcategory(
      { categoryUuid: uuid, code: 'HOUSE', name: 'House' },
      actor,
    );
    await service.updateSubcategory(uuid, undefined, {}, actor);
    await service.getSubcategory(uuid);
    await service.listSubcategories({ page: 1, limit: 10 });
    await service.deleteSubcategory(uuid, actor);
    await service.createLocation('country', {}, actor);
    await service.updateLocation('country', uuid, undefined, {}, actor);
    await service.getLocation('country', uuid);
    await service.listLocations('country', { page: 1, limit: 10 });
    await service.deleteLocation('country', uuid, actor);
    await service.children('country', uuid);
    await service.createFacility(
      { code: 'PARK', name: 'Parking', category: 'PARKING' } as never,
      actor,
    );
    await service.updateFacility(uuid, undefined, {}, actor);
    await service.getFacility(uuid);
    await service.listFacilities({ page: 1, limit: 10 });
    await service.deleteFacility(uuid, actor);

    await service.createProperty(
      {
        title: 'House',
        availableFrom: '2026-01-01',
        availableTo: '2026-12-31',
      },
      actor,
    );
    await expect(
      service.createProperty(
        { availableFrom: '2027-01-01', availableTo: '2026-01-01' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.updateProperty(uuid, 1, {}, actor);
    repository.getProperty.mockResolvedValueOnce({ uuid, status: 'DRAFT' });
    await expect(
      service.updateProperty(uuid, 1, { status: 'ACTIVE' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.getProperty.mockResolvedValueOnce({ uuid, status: 'IN_REVIEW' });
    repository.updateProperty.mockResolvedValueOnce({
      uuid,
      status: 'IN_REVIEW',
      verifiedAt: now,
    });
    await service.verifyProperty(uuid, 1, actor);
    repository.getProperty.mockResolvedValueOnce({
      uuid,
      status: 'IN_REVIEW',
      verifiedAt: now,
    });
    repository.updateProperty.mockResolvedValueOnce({
      uuid,
      status: 'ACTIVE',
      publishedAt: now,
    });
    await service.publishProperty(uuid, 2, actor);
    await service.deleteProperty(uuid, actor);
    await service.restoreProperty(uuid, actor);
    await service.duplicateProperty(uuid, actor);

    const masterErrors: readonly Error[] = [
      namedMasterError('MasterNotFoundError', 'Resource not found'),
      new MasterConflictError(),
      new MasterHierarchyError(),
      new MasterInUseError(),
      new MasterConcurrencyError(),
      new MasterStateError(),
    ];
    for (const error of masterErrors) {
      repository.getProperty.mockRejectedValueOnce(error);
      await expect(service.getProperty(uuid)).rejects.toBeInstanceOf(Error);
    }
  });

  it('covers property lifecycle, property types and deletion branches', async () => {
    const lifecycleRepo = {
      verify: vi
        .fn()
        .mockResolvedValue({ uuid, status: 'IN_REVIEW', verifiedAt: now }),
      publish: vi
        .fn()
        .mockResolvedValue({ uuid, status: 'ACTIVE', publishedAt: now }),
    } satisfies PropertyLifecycleRepository;
    const lifecycle = new PropertyLifecycleService(lifecycleRepo, audit);
    await lifecycle.verify(uuid, 1, actor);
    await lifecycle.publish(uuid, 2, actor);
    lifecycleRepo.publish = vi
      .fn()
      .mockResolvedValue({ uuid, status: 'DRAFT' });
    await expect(lifecycle.publish(uuid, 2, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    lifecycleRepo.verify = vi.fn().mockRejectedValue(
      namedMasterError('MasterNotFoundError', 'Resource not found'),
    );
    await expect(lifecycle.verify(uuid, 1, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    lifecycleRepo.publish = vi
      .fn()
      .mockRejectedValue(new MasterConcurrencyError());
    await expect(lifecycle.publish(uuid, 1, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const typeSnapshot = {
      uuid,
      code: 'HOUSE',
      name: 'House',
      slug: 'house',
      description: null,
      icon: null,
      isActive: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const propertyType = PropertyTypeEntity.create(typeSnapshot);
    expect(propertyType.isAccessible()).toBe(true);
    propertyType.update({
      name: ' Villa ',
      slug: 'villa',
      isActive: false,
      description: 'desc',
      icon: 'home',
      sortOrder: 2,
    });
    expect(propertyType.isAccessible()).toBe(false);
    propertyType.softDelete(now);
    propertyType.softDelete(now);
    expect(propertyType.isDeleted()).toBe(true);
    expect(() =>
      PropertyTypeEntity.create({ ...typeSnapshot, uuid: 'bad' }),
    ).toThrow();
    expect(() =>
      PropertyTypeEntity.create({ ...typeSnapshot, code: 'bad code' }),
    ).toThrow();
    expect(() =>
      PropertyTypeEntity.create({ ...typeSnapshot, name: 'x' }),
    ).toThrow();
    expect(() =>
      PropertyTypeEntity.create({ ...typeSnapshot, slug: 'Bad Slug' }),
    ).toThrow();
    expect(() =>
      PropertyTypeEntity.create({
        ...typeSnapshot,
        description: 'x'.repeat(5001),
      }),
    ).toThrow();
    expect(() =>
      PropertyTypeEntity.create({ ...typeSnapshot, icon: ' ' }),
    ).toThrow();
    expect(() =>
      PropertyTypeEntity.create({ ...typeSnapshot, sortOrder: -1 }),
    ).toThrow();
    expect(() =>
      PropertyTypeEntity.create({
        ...typeSnapshot,
        deletedAt: now,
        isActive: true,
      }),
    ).toThrow();

    const listRepo = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const listTypes = new ListPropertyTypesUseCase(listRepo);
    await listTypes.execute({ page: 1, limit: 10, sortBy: 'name' });
    await expect(
      listTypes.execute({ page: 1, limit: 10, sortBy: 'name' }),
    ).resolves.toMatchObject({ total: 0 });

    const deleteRepo = {
      findByUuid: vi.fn().mockResolvedValue(propertyType),
      getDependencyCount: vi.fn().mockResolvedValue({ propertyCount: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const deleteType = new DeletePropertyTypeUseCase(deleteRepo);
    await deleteType.execute(uuid, actor);
    deleteRepo.findByUuid.mockResolvedValueOnce(null);
    await expect(deleteType.execute(uuid, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    deleteRepo.findByUuid.mockResolvedValue(propertyType);
    deleteRepo.getDependencyCount.mockResolvedValueOnce({ propertyCount: 1 });
    await expect(deleteType.execute(uuid, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('covers listing lifecycle, errors and expiry worker behavior', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ uuid, status: 'DRAFT' }),
      findOne: vi.fn().mockResolvedValue({ uuid, status: 'DRAFT', version: 1 }),
      update: vi.fn().mockResolvedValue({ uuid, status: 'DRAFT', version: 2 }),
      transition: vi
        .fn()
        .mockResolvedValue({ uuid, status: 'PUBLISHED', version: 2 }),
      expireDue: vi.fn().mockResolvedValue([uuid]),
      duplicate: vi.fn().mockResolvedValue({ uuid: uuid2 }),
      assignAgent: vi.fn().mockResolvedValue(undefined),
      changeAgent: vi.fn().mockResolvedValue(undefined),
      assignOwner: vi.fn().mockResolvedValue(undefined),
      getPropertyDetail: vi.fn().mockResolvedValue({ uuid }),
      search: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }),
    } satisfies ListingRepository;
    const listing = new ListingService(repository, audit);
    const input = {
      propertyUuid: uuid,
      transactionType: 'SALE',
      title: 'House',
      price: {
        currency: 'IDR',
        priceType: 'TOTAL',
        minPrice: '100',
        maxPrice: '200',
      },
      payments: [],
    } as never;
    await listing.create(input, { actorUuid: uuid });
    await listing.get(uuid);
    await listing.update(uuid, 1, input, { actorUuid: uuid });
    await listing.transition(
      uuid,
      1,
      'PUBLISHED',
      { actorUuid: uuid },
      'reason',
    );
    await listing.duplicate(uuid, { actorUuid: uuid });
    await listing.assignAgent(uuid, uuid2, 'Agent', true, { actorUuid: uuid });
    await listing.changeAgent(uuid, uuid2, uuid2, 'Agent', false, {
      actorUuid: uuid,
    });
    await listing.assignOwner(uuid, 'USER' as never, 'Owner', {
      actorUuid: uuid,
    });
    await listing.detail(uuid, uuid);
    await listing.search({ page: 1, limit: 10 });

    repository.getPropertyDetail = vi.fn();
    await expect(listing.detail(uuid, uuid)).rejects.toBeInstanceOf(Error);
    repository.findOne.mockRejectedValueOnce(new ListingNotFoundError());
    await expect(listing.get(uuid)).rejects.toBeInstanceOf(NotFoundException);
    repository.findOne.mockRejectedValueOnce(new ListingConflictError());
    await expect(listing.get(uuid)).rejects.toBeInstanceOf(ConflictException);
    repository.findOne.mockRejectedValueOnce(new ListingStateError());
    await expect(listing.get(uuid)).rejects.toBeInstanceOf(ConflictException);
    repository.findOne.mockRejectedValueOnce(new ListingValidationError('bad'));
    await expect(listing.get(uuid)).rejects.toBeInstanceOf(BadRequestException);

    const worker = new ListingExpiryWorker(repository, audit);
    worker.onModuleInit();
    worker.onModuleDestroy();
    await Promise.resolve();
    expect(repository.expireDue).toHaveBeenCalledTimes(1);
  });

  it('covers property extras and listing errors', () => {
    expect(hashSensitive('secret')).not.toBe('secret');
    expect(maskSensitive('abcdef')).not.toBe('abcdef');
    expect(() => validateCertificateInput({})).not.toThrow();
    expect(() => validateCertificateDates({})).not.toThrow();
    expect(() => validateFinancialInvariants({})).not.toThrow();
    expect(() => validateLegalInvariants({})).not.toThrow();
    expect(() => validateMedia({})).not.toThrow();
    expect(() =>
      validateSeoInvariants('villa-bali', { canonicalUrl: 'x' }),
    ).toThrow('canonicalUrl must end');
    expect(() =>
      validateSeoInvariants('villa-bali', {
        canonicalUrl: 'javascript:alert(1)',
      }),
    ).toThrow();
    expect(() => validateUtilityInvariants({})).not.toThrow();
  });
});
