import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PropertyTypeEntity } from '../../../src/modules/property/domain/entities/property-type.entity.js';
import {
  PropertyTypeAlreadyExistsException,
  PropertyTypeNotFoundException,
} from '../../../src/modules/property/domain/errors/property-type.errors.js';
import type {
  PropertyTypeRepository,
  PropertyTypeListQuery,
} from '../../../src/modules/property/domain/repositories/property-type.repository.js';
import { CreatePropertyTypeUseCase } from '../../../src/modules/property/application/use-cases/create-property-type.use-case.js';
import { UpdatePropertyTypeUseCase } from '../../../src/modules/property/application/use-cases/update-property-type.use-case.js';
import { GetPropertyTypeUseCase } from '../../../src/modules/property/application/use-cases/get-property-type.use-case.js';
import { ListPropertyTypesUseCase } from '../../../src/modules/property/application/use-cases/list-property-types.use-case.js';
import { DeletePropertyTypeUseCase } from '../../../src/modules/property/application/use-cases/delete-property-type.use-case.js';
import type { CreatePropertyTypeDto } from '../../../src/modules/property/application/dto/create-property-type.dto.js';
import type { UpdatePropertyTypeDto } from '../../../src/modules/property/application/dto/update-property-type.dto.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';

const snapshot = (
  overrides: Partial<Parameters<typeof PropertyTypeEntity.create>[0]> = {},
) => ({
  uuid: randomUUID(),
  code: 'HOUSE',
  name: 'House',
  slug: 'house',
  description: null,
  icon: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-08-27T00:00:00.000Z'),
  updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});
const dto = (
  overrides: Partial<CreatePropertyTypeDto> = {},
): CreatePropertyTypeDto =>
  Object.assign(new (class {})(), {
    code: 'house',
    name: '  House  ',
    slug: 'House',
    ...overrides,
  }) as CreatePropertyTypeDto;
const updateDto = (
  overrides: Partial<UpdatePropertyTypeDto> = {},
): UpdatePropertyTypeDto =>
  Object.assign(new (class {})(), overrides) as UpdatePropertyTypeDto;
type PropertyTypeRepositoryMocks = {
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findByCode: ReturnType<typeof vi.fn>;
  findBySlug: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
};
type TestPropertyTypeRepository = PropertyTypeRepository & {
  mocks: PropertyTypeRepositoryMocks;
};
const repository = (): TestPropertyTypeRepository => {
  const mocks = {
    create: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    findBySlug: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  return { ...mocks, mocks };
};
type TestAudit = SecurityAuditRepository & {
  mocks: { record: ReturnType<typeof vi.fn> };
};
const audit = (): TestAudit => {
  const record = vi.fn();
  return { record, mocks: { record } };
};
const context = { actorUuid: randomUUID(), ipAddress: '127.0.0.1' };

describe('PropertyType domain and application', () => {
  it('enforces domain invariants and soft-delete state', () => {
    expect(() =>
      PropertyTypeEntity.create(snapshot({ code: 'house' })),
    ).toThrow('Invalid property type code');
    expect(() =>
      PropertyTypeEntity.create(snapshot({ sortOrder: -1 })),
    ).toThrow('Invalid property type sort order');
    const entity = PropertyTypeEntity.create(snapshot());
    expect(entity.isAccessible()).toBe(true);
    entity.softDelete(new Date('2026-08-27T01:00:00.000Z'));
    expect(entity.isDeleted()).toBe(true);
    expect(entity.isActive).toBe(false);
    expect(entity.isAccessible()).toBe(false);
  });
  it('creates normalized property types and audits the mutation', async () => {
    const repo = repository();
    const audits = audit();
    const created = PropertyTypeEntity.create(
      snapshot({ code: 'HOUSE', slug: 'house' }),
    );
    repo.mocks.findByCode.mockResolvedValue(null);
    repo.mocks.findBySlug.mockResolvedValue(null);
    repo.mocks.create.mockResolvedValue(created);
    const result = await new CreatePropertyTypeUseCase(repo, audits).execute(
      dto(),
      context,
    );
    expect(result).toBe(created);
    expect(repo.mocks.create.mock.calls).toContainEqual([
      expect.objectContaining({ code: 'HOUSE', name: 'House', slug: 'house' }),
    ]);
    expect(audits.mocks.record.mock.calls).toContainEqual([
      expect.objectContaining({ action: 'PROPERTY_TYPE_CREATED' }),
    ]);
  });
  it('rejects duplicate code and duplicate slug on create', async () => {
    const repo = repository();
    const existing = PropertyTypeEntity.create(snapshot());
    repo.mocks.findByCode.mockResolvedValue(existing);
    await expect(
      new CreatePropertyTypeUseCase(repo, audit()).execute(dto(), context),
    ).rejects.toBeInstanceOf(PropertyTypeAlreadyExistsException);
    const slugRepo = repository();
    slugRepo.mocks.findByCode.mockResolvedValue(null);
    slugRepo.mocks.findBySlug.mockResolvedValue(existing);
    await expect(
      new CreatePropertyTypeUseCase(slugRepo, audit()).execute(dto(), context),
    ).rejects.toBeInstanceOf(PropertyTypeAlreadyExistsException);
  });
  it('updates allowed fields and rejects duplicate identifiers', async () => {
    const repo = repository();
    const audits = audit();
    const current = PropertyTypeEntity.create(snapshot());
    const updated = PropertyTypeEntity.create(
      snapshot({ code: 'VILLA', name: 'Villa', slug: 'villa' }),
    );
    repo.mocks.findById.mockResolvedValue(current);
    repo.mocks.findByCode.mockResolvedValue(null);
    repo.mocks.findBySlug.mockResolvedValue(null);
    repo.mocks.update.mockResolvedValue(updated);
    await expect(
      new UpdatePropertyTypeUseCase(repo, audits).execute(
        current.uuid,
        updateDto({ code: 'villa', name: 'Villa', slug: 'villa' }),
        context,
      ),
    ).resolves.toBe(updated);
    expect(repo.mocks.update.mock.calls).toContainEqual([
      current.uuid,
      expect.objectContaining({ code: 'VILLA', name: 'Villa', slug: 'villa' }),
    ]);
    repo.mocks.findByCode.mockResolvedValue(updated);
    await expect(
      new UpdatePropertyTypeUseCase(repo, audit()).execute(
        current.uuid,
        updateDto({ code: 'villa' }),
        context,
      ),
    ).rejects.toBeInstanceOf(PropertyTypeAlreadyExistsException);
  });
  it('returns current entity for an empty update and rejects missing entities', async () => {
    const repo = repository();
    const current = PropertyTypeEntity.create(snapshot());
    repo.mocks.findById.mockResolvedValue(current);
    await expect(
      new UpdatePropertyTypeUseCase(repo, audit()).execute(
        current.uuid,
        updateDto(),
        context,
      ),
    ).resolves.toBe(current);
    repo.mocks.findById.mockResolvedValue(null);
    await expect(
      new UpdatePropertyTypeUseCase(repo, audit()).execute(
        current.uuid,
        updateDto({ name: 'X' }),
        context,
      ),
    ).rejects.toBeInstanceOf(PropertyTypeNotFoundException);
  });
  it('gets property type and rejects not found', async () => {
    const repo = repository();
    const current = PropertyTypeEntity.create(snapshot());
    repo.mocks.findById.mockResolvedValue(current);
    await expect(
      new GetPropertyTypeUseCase(repo).execute(current.uuid),
    ).resolves.toBe(current);
    repo.mocks.findById.mockResolvedValue(null);
    await expect(
      new GetPropertyTypeUseCase(repo).execute(current.uuid),
    ).rejects.toBeInstanceOf(PropertyTypeNotFoundException);
  });
  it('lists with validated pagination, filter, and sorting', async () => {
    const repo = repository();
    const items = [PropertyTypeEntity.create(snapshot())];
    const query: PropertyTypeListQuery = {
      page: 2,
      limit: 20,
      filterField: 'isActive',
      filterValue: true,
      sortBy: 'sortOrder',
      sortDirection: 'asc',
      search: 'house',
    };
    repo.mocks.list.mockResolvedValue({ items, total: 21, page: 2, limit: 20 });
    await expect(
      new ListPropertyTypesUseCase(repo).execute(query),
    ).resolves.toMatchObject({ total: 21, page: 2 });
    expect(repo.mocks.list.mock.calls).toContainEqual([query]);
    await expect(
      new ListPropertyTypesUseCase(repo).execute({
        ...query,
        filterValue: 'true' as never,
      }),
    ).rejects.toThrow('isActive filterValue');
  });
  it('soft-deletes existing property types', async () => {
    const repo = repository();
    const audits = audit();
    const current = PropertyTypeEntity.create(snapshot());
    repo.mocks.findById.mockResolvedValue(current);
    repo.mocks.softDelete.mockResolvedValue(undefined);
    await expect(
      new DeletePropertyTypeUseCase(repo, audits).execute(
        current.uuid,
        context,
      ),
    ).resolves.toBeUndefined();
    expect(repo.mocks.softDelete.mock.calls).toContainEqual([current.uuid]);
    expect(audits.mocks.record.mock.calls).toContainEqual([
      expect.objectContaining({ action: 'PROPERTY_TYPE_DELETED' }),
    ]);
  });
});
