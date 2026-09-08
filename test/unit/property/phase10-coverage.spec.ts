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
  MasterNotFoundError,
  MasterStateError,
} from '../../../src/modules/property/domain/errors.js';
import {
  ListingConflictError,
  ListingNotFoundError,
  ListingStateError,
  ListingValidationError,
} from '../../../src/modules/property/listing/infrastructure/listing.repository.js';
import {
  Money,
  maskSensitive,
  hashSensitive,
  validateCertificateDates,
  validateCertificateInput,
  validateFinancialInvariants,
  validateLegalInvariants,
  validateMedia,
  validateSeoInvariants,
  validateUtilityInvariants,
} from '../../../src/modules/property/domain/property-extras.js';
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

const detailRepository = (): PropertyDetailsRepository => ({
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
});

const audit = { record: vi.fn().mockResolvedValue(undefined) };

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
      [
        new (MasterNotFoundError as unknown as new () => Error)(),
        NotFoundException,
      ],
      [
        new (MasterConflictError as unknown as new () => Error)(),
        ConflictException,
      ],
      [
        new (MasterConcurrencyError as unknown as new () => Error)(),
        ConflictException,
      ],
      [
        new (MasterInUseError as unknown as new () => Error)(),
        ConflictException,
      ],
      [
        new (MasterHierarchyError as unknown as new () => Error)(),
        BadRequestException,
      ],
      [
        new (MasterStateError as unknown as new () => Error)(),
        BadRequestException,
      ],
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
    } as unknown as PropertyMasterRepository;
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

    for (const ErrorType of [
      MasterNotFoundError,
      MasterConflictError,
      MasterHierarchyError,
      MasterInUseError,
      MasterConcurrencyError,
      MasterStateError,
    ]) {
      repository.getProperty.mockRejectedValueOnce(new ErrorType());
      await expect(service.getProperty(uuid)).rejects.toBeInstanceOf(Error);
    }
  });

  it('covers property lifecycle, property types and deletion branches', async () => {
    const lifecycleRepo: PropertyLifecycleRepository = {
      verify: vi
        .fn()
        .mockResolvedValue({ uuid, status: 'IN_REVIEW', verifiedAt: now }),
      publish: vi
        .fn()
        .mockResolvedValue({ uuid, status: 'ACTIVE', publishedAt: now }),
    };
    const lifecycle = new PropertyLifecycleService(lifecycleRepo, audit);
    await lifecycle.verify(uuid, 1, actor);
    await lifecycle.publish(uuid, 2, actor);
    lifecycleRepo.publish = vi
      .fn()
      .mockResolvedValue({ uuid, status: 'DRAFT' });
    await expect(lifecycle.publish(uuid, 2, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    lifecycleRepo.verify = vi.fn().mockRejectedValue(new MasterNotFoundError());
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
    for (const query of [
      { page: 1, limit: 10, sortBy: 'name', filterField: 'bad' },
      { page: 1, limit: 10, sortBy: 'name', filterValue: 'x' },
      { page: 1, limit: 10, sortBy: 'bad' },
      { page: 0, limit: 10, sortBy: 'name' },
      { page: 1, limit: 101, sortBy: 'name' },
      {
        page: 1,
        limit: 10,
        sortBy: 'name',
        filterField: 'isActive',
        filterValue: 'x',
      },
    ])
      await expect(listTypes.execute(query)).rejects.toThrow();

    const typeRepo = {
      findById: vi.fn().mockResolvedValue(propertyType),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    const deleteType = new DeletePropertyTypeUseCase(typeRepo, audit);
    await deleteType.execute(uuid, actor);
    typeRepo.findById.mockResolvedValueOnce(null);
    await expect(deleteType.execute(uuid, actor)).rejects.toThrow(
      'Property type not found',
    );
    typeRepo.findById.mockResolvedValueOnce(
      PropertyTypeEntity.create({
        ...typeSnapshot,
        deletedAt: now,
        isActive: false,
      }),
    );
    await expect(deleteType.execute(uuid, actor)).rejects.toThrow(
      'Property type not found',
    );
  });

  it('covers listing lifecycle, invariant errors and expiry worker execution', async () => {
    const repository: ListingRepository = {
      create: vi.fn().mockResolvedValue({ uuid }),
      findOne: vi.fn().mockResolvedValue({ uuid }),
      update: vi.fn().mockResolvedValue({ uuid }),
      transition: vi.fn().mockResolvedValue({ uuid }),
      duplicate: vi.fn().mockResolvedValue({ uuid }),
      assignAgent: vi.fn().mockResolvedValue({ uuid }),
      changeAgent: vi.fn().mockResolvedValue({ uuid }),
      assignOwner: vi.fn().mockResolvedValue({ uuid }),
      getPropertyDetail: vi.fn().mockResolvedValue({ uuid }),
      search: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }),
      expireDue: vi.fn().mockResolvedValue([uuid, uuid2]),
    };
    const service = new ListingService(repository, audit);
    const input = {
      propertyUuid: uuid,
      price: {
        currency: 'IDR',
        priceType: 'TOTAL',
        minPrice: '100',
        maxPrice: '200',
      },
      payments: [],
    } as never;
    await service.create(input, { actorUuid: uuid });
    await service.get(uuid);
    await service.update(uuid, 1, input, { actorUuid: uuid });
    await service.transition(
      uuid,
      1,
      'PUBLISHED',
      { actorUuid: uuid },
      'reason',
    );
    await service.duplicate(uuid, { actorUuid: uuid });
    await service.assignAgent(uuid, uuid2, 'Agent', true, { actorUuid: uuid });
    await service.changeAgent(uuid, uuid2, uuid2, 'Agent', false, {
      actorUuid: uuid,
    });
    await service.assignOwner(uuid, 'USER' as never, 'Owner', {
      actorUuid: uuid,
    });
    await service.detail(uuid, uuid);
    await service.search({ page: 1, limit: 10 });

    repository.getPropertyDetail = vi
      .fn()
      .mockRejectedValue(new ListingNotFoundError());
    await expect(service.detail(uuid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    repository.getPropertyDetail = vi
      .fn()
      .mockRejectedValue(new ListingConflictError());
    await expect(service.detail(uuid)).rejects.toBeInstanceOf(
      ConflictException,
    );
    repository.getPropertyDetail = vi
      .fn()
      .mockRejectedValue(new ListingStateError());
    await expect(service.detail(uuid)).rejects.toBeInstanceOf(
      ConflictException,
    );
    repository.getPropertyDetail = vi
      .fn()
      .mockRejectedValue(new ListingValidationError());
    await expect(service.detail(uuid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    repository.getPropertyDetail = vi
      .fn()
      .mockRejectedValue(new Error('unexpected'));
    await expect(service.detail(uuid)).rejects.toThrow('unexpected');

    const worker = new ListingExpiryWorker(repository, audit);
    await (worker as unknown as { expireDue: () => Promise<void> }).expireDue();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'property.listing.expired',
        entityUuid: uuid,
        actorType: 'SYSTEM',
      }),
    );
    worker.onModuleInit();
    worker.onModuleDestroy();

    const money = new Money('12.50', 'IDR');
    expect(money.amount).toBe('12.5');
    expect(money.toMinorUnits()).toBe(1250n);
    expect(money.round(0).amount).toBe('13');
    expect(new Money('12.50', 'IDR').round(1).amount).toBe('12.5');
    expect(() => new Money('-1', 'IDR')).toThrow();
    expect(() => new Money('1', 'ID')).toThrow();
    expect(() => money.round(3)).toThrow();
    expect(hashSensitive(' secret ')).toHaveLength(64);
    expect(maskSensitive('12345678', 4)).toBe('****5678');
  });

  it('covers property extras invariants across utilities, legal, financial, SEO and media', () => {
    validateUtilityInvariants({
      electricityCapacityKva: '10',
      backupPowerType: 'GENERATOR',
      backupPowerCapacityKva: '5',
    });
    expect(() =>
      validateUtilityInvariants({
        waterSource: 'PDAM',
        waterBackupSource: 'PDAM',
      }),
    ).toThrow();
    expect(() => validateUtilityInvariants({ internetFiber: true })).toThrow();
    expect(() =>
      validateUtilityInvariants({ backupPowerType: 'GENERATOR' }),
    ).toThrow();
    expect(() =>
      validateUtilityInvariants({
        backupPowerType: 'NONE',
        backupPowerCapacityKva: '1',
      }),
    ).toThrow();
    expect(() =>
      validateUtilityInvariants({ internetProviders: [' '] }),
    ).toThrow();
    expect(() =>
      validateUtilityInvariants({ electricityCapacityKva: '-1' }),
    ).toThrow();

    validateLegalInvariants({
      buildingCoverageRatio: '50',
      floorAreaRatio: '2',
    });
    expect(() =>
      validateLegalInvariants({ buildingCoverageRatio: '101' }),
    ).toThrow();
    expect(() =>
      validateLegalInvariants({
        ownershipStatus: 'VERIFIED',
        verificationStatus: 'PENDING',
      }),
    ).toThrow();
    expect(() =>
      validateLegalInvariants({ verificationStatus: 'VERIFIED' }),
    ).toThrow();
    expect(() =>
      validateLegalInvariants({
        verificationStatus: 'VERIFIED',
        verifiedAt: '2026-01-01',
        ownershipStatus: 'REJECTED',
      }),
    ).toThrow();

    validateCertificateInput({
      type: 'SHM',
      number: 'N-1',
      issueDate: '2026-01-01',
      expiryDate: '2027-01-01',
    });
    expect(() =>
      validateCertificateInput({ type: 'SHM', number: ' ' }),
    ).toThrow();
    expect(() => validateCertificateDates('bad')).toThrow();
    expect(() =>
      validateCertificateDates('2027-01-01', '2026-01-01'),
    ).toThrow();
    expect(() =>
      validateCertificateDates(undefined, undefined, 'EXPIRED'),
    ).toThrow();

    validateFinancialInvariants({
      askingPrice: '100.00',
      rentalYield: '5.1234',
      currency: 'IDR',
    });
    expect(() => validateFinancialInvariants({ askingPrice: '-1' })).toThrow();
    expect(() => validateFinancialInvariants({ currency: 'ID' })).toThrow();

    validateSeoInvariants('house', {
      title: 'House',
      description: 'Desc',
      canonicalUrl: 'https://example.com/properties/house',
      ogImageUrl: 'https://cdn.example.com/a.jpg',
      keywords: ['house'],
    });
    expect(() => validateSeoInvariants('house', { title: '' })).toThrow();
    expect(() =>
      validateSeoInvariants('house', { title: 'x'.repeat(61) }),
    ).toThrow();
    expect(() =>
      validateSeoInvariants('house', { canonicalUrl: 'not-url' }),
    ).toThrow();
    expect(() =>
      validateSeoInvariants('house', {
        canonicalUrl: 'https://example.com/other',
      }),
    ).toThrow();

    validateMedia({
      type: 'IMAGE',
      url: 'https://cdn.example.com/a.jpg',
      mimeType: 'image/jpeg',
      extension: '.jpg',
      isCover: true,
    });
    validateMedia({
      type: 'VIDEO',
      url: 'https://cdn.example.com/a.mp4',
      mimeType: 'video/mp4',
      extension: '.mp4',
      durationMs: 1000,
    });
    expect(() =>
      validateMedia({
        type: 'IMAGE',
        url: 'http://127.0.0.1/a.jpg',
        mimeType: 'image/jpeg',
      }),
    ).toThrow();
    expect(() =>
      validateMedia({
        type: 'IMAGE',
        url: 'https://cdn.example.com/a.txt',
        mimeType: 'image/jpeg',
        extension: 'txt',
      }),
    ).toThrow();
    expect(() =>
      validateMedia({
        type: 'VIDEO',
        url: 'https://cdn.example.com/a.mp4',
        mimeType: 'video/mp4',
        durationMs: null,
      }),
    ).toThrow();
    expect(() =>
      validateMedia({
        type: 'VIDEO',
        url: 'https://cdn.example.com/a.mp4',
        mimeType: 'video/mp4',
        isCover: true,
      }),
    ).toThrow();
    expect(() =>
      validateMedia({
        type: 'IMAGE',
        url: 'https://cdn.example.com/a.jpg',
        mimeType: 'text/plain',
      }),
    ).toThrow();
    expect(() =>
      validateMedia({
        type: 'IMAGE',
        url: 'https://cdn.example.com/a.jpg',
        mimeType: 'image/jpeg',
        widthPx: 0,
      }),
    ).toThrow();
    expect(() =>
      validateMedia({
        type: 'IMAGE',
        url: 'https://cdn.example.com/a.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 600000000,
      }),
    ).toThrow();
  });
});
