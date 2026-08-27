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
const repository = (): PropertyTypeRepository => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  findBySlug: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
});
const audit = (): SecurityAuditRepository => ({ record: vi.fn() });
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
    vi.mocked(repo.findByCode).mockResolvedValue(null);
    vi.mocked(repo.findBySlug).mockResolvedValue(null);
    vi.mocked(repo.create).mockResolvedValue(created);
    const result = await new CreatePropertyTypeUseCase(repo, audits).execute(
      dto(),
      context,
    );
    expect(result).toBe(created);
    expect(vi.mocked(repo.create).mock.calls).toContainEqual([
      expect.objectContaining({ code: 'HOUSE', name: 'House', slug: 'house' }),
    ]);
    expect(vi.mocked(audits.record).mock.calls).toContainEqual([
      expect.objectContaining({ action: 'PROPERTY_TYPE_CREATED' }),
    ]);
  });

  it('rejects duplicate code and duplicate slug on create', async () => {
    const repo = repository();
    const existing = PropertyTypeEntity.create(snapshot());
    vi.mocked(repo.findByCode).mockResolvedValue(existing);
    await expect(
      new CreatePropertyTypeUseCase(repo, audit()).execute(dto(), context),
    ).rejects.toBeInstanceOf(PropertyTypeAlreadyExistsException);
    const slugRepo = repository();
    vi.mocked(slugRepo.findByCode).mockResolvedValue(null);
    vi.mocked(slugRepo.findBySlug).mockResolvedValue(existing);
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
    vi.mocked(repo.findById).mockResolvedValue(current);
    vi.mocked(repo.findByCode).mockResolvedValue(null);
    vi.mocked(repo.findBySlug).mockResolvedValue(null);
    vi.mocked(repo.update).mockResolvedValue(updated);
    await expect(
      new UpdatePropertyTypeUseCase(repo, audits).execute(
        current.uuid,
        updateDto({ code: 'villa', name: 'Villa', slug: 'villa' }),
        context,
      ),
    ).resolves.toBe(updated);
    expect(vi.mocked(repo.update).mock.calls).toContainEqual([
      current.uuid,
      expect.objectContaining({ code: 'VILLA', name: 'Villa', slug: 'villa' }),
    ]);
    vi.mocked(repo.findByCode).mockResolvedValue(updated);
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
    vi.mocked(repo.findById).mockResolvedValue(current);
    await expect(
      new UpdatePropertyTypeUseCase(repo, audit()).execute(
        current.uuid,
        updateDto(),
        context,
      ),
    ).resolves.toBe(current);
    vi.mocked(repo.findById).mockResolvedValue(null);
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
    vi.mocked(repo.findById).mockResolvedValue(current);
    await expect(
      new GetPropertyTypeUseCase(repo).execute(current.uuid),
    ).resolves.toBe(current);
    vi.mocked(repo.findById).mockResolvedValue(null);
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
    vi.mocked(repo.list).mockResolvedValue({
      items,
      total: 21,
      page: 2,
      limit: 20,
    });
    await expect(
      new ListPropertyTypesUseCase(repo).execute(query),
    ).resolves.toMatchObject({ total: 21, page: 2 });
    expect(vi.mocked(repo.list).mock.calls).toContainEqual([query]);
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
    vi.mocked(repo.findById).mockResolvedValue(current);
    vi.mocked(repo.softDelete).mockResolvedValue(undefined);
    await expect(
      new DeletePropertyTypeUseCase(repo, audits).execute(
        current.uuid,
        context,
      ),
    ).resolves.toBeUndefined();
    expect(vi.mocked(repo.softDelete).mock.calls).toContainEqual([
      current.uuid,
    ]);
    expect(vi.mocked(audits.record).mock.calls).toContainEqual([
      expect.objectContaining({ action: 'PROPERTY_TYPE_DELETED' }),
    ]);
  });
});
