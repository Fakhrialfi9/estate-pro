import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  normalizeCode,
  normalizeSlug,
  type ActorContext,
  type AvailabilityStatus,
  type FacilityCategory,
  type PageRequest,
  type PropertyStatus,
} from '../../domain/property-master.types.js';
import {
  MasterConcurrencyError,
  MasterConflictError,
  MasterHierarchyError,
  MasterInUseError,
  MasterNotFoundError,
} from '../../domain/errors.js';
import type {
  MasterQuery,
  PropertyMasterRepository,
} from '../../domain/repositories/property-master.repository.js';
import type { PageResult } from '../../domain/property-master.types.js';

type Row = Record<string, unknown>;
type Delegate = {
  findFirst(args: object): Promise<unknown>;
  findUnique(args: object): Promise<unknown>;
  findMany(args: object): Promise<unknown[]>;
  count(args: object): Promise<number>;
  create(args: object): Promise<unknown>;
  update(args: object): Promise<unknown>;
  updateMany(args: object): Promise<{ count: number }>;
};

const row = (value: unknown): Row => {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid persistence result');
  return value as Row;
};
const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const optionalText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : null;
};
const dateValue = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const dbCode = (error: unknown): string => {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const value = (error as { code?: unknown }).code;
  return typeof value === 'string' ? value : '';
};
const mapError = (error: unknown): never => {
  if (
    error instanceof MasterConcurrencyError ||
    error instanceof MasterConflictError ||
    error instanceof MasterHierarchyError ||
    error instanceof MasterInUseError ||
    error instanceof MasterNotFoundError
  )
    throw error;
  const code = dbCode(error);
  if (code === 'P2002')
    throw new MasterConflictError('A unique property value already exists');
  if (code === 'P2025') throw new MasterNotFoundError();
  if (code === 'P2003' || code === 'P2014')
    throw new MasterInUseError('Resource is still referenced');
  throw error;
};
const unwrap = (value: unknown): Row => row(value);
const pageOf = (
  q: PageRequest,
): { page: number; limit: number; skip: number } => {
  const page =
    Number.isInteger(q.page) && (q.page ?? 1) > 0 ? (q.page ?? 1) : 1;
  const limit = Number.isInteger(q.limit)
    ? Math.min(100, Math.max(1, q.limit ?? 20))
    : 20;
  return { page, limit, skip: (page - 1) * limit };
};
const orderOf = (q: PageRequest, allowed: readonly string[]): Row[] => {
  const field =
    q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : (allowed[0] ?? 'uuid');
  const direction = q.sortDirection === 'desc' ? 'desc' : 'asc';
  return [{ [field]: direction }, { uuid: 'asc' }];
};

@Injectable()
export class PrismaPropertyMasterStore implements PropertyMasterRepository {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(client: object, model: string): Delegate {
    const value = (client as Record<string, unknown>)[model];
    if (!value || typeof value !== 'object')
      throw new Error(`Unsupported persistence model: ${model}`);
    return value as Delegate;
  }

  async createCategory(input: Row): Promise<unknown> {
    try {
      const type = await this.prisma.propertyType.findFirst({
        where: { uuid: text(input.typeUuid), deletedAt: null, isActive: true },
      });
      if (!type) throw new MasterHierarchyError('Property type not found or inactive');
      const typeRecord = row(type);
      return this.prisma.propertyCategory.create({
        data: {
          uuid: randomUUID(),
          propertyTypeId: typeRecord.id,
          code: normalizeCode(text(input.code)),
          name: text(input.name).trim(),
          slug: normalizeSlug(text(input.slug, text(input.name))),
          description: optionalText(input.description),
          icon: optionalText(input.icon),
          isActive: input.isActive !== false,
          sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 0,
        },
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async updateCategory(uuid: string, version: number, patch: Row): Promise<unknown> {
    if (version < 1) throw new MasterConcurrencyError('Version must be positive');
    try {
      const current = unwrap(
        await this.prisma.propertyCategory.findFirst({ where: { uuid, deletedAt: null } }),
      );
      const data: Row = { version: { increment: 1 } };
      const code = optionalText(patch.code);
      const name = optionalText(patch.name);
      const slug = optionalText(patch.slug);
      if (code !== null) data.code = normalizeCode(code);
      if (name !== null) data.name = name.trim();
      if (slug !== null || name !== null)
        data.slug = normalizeSlug(slug ?? name ?? text(current.slug));
      if (typeof patch.description === 'string') data.description = patch.description.trim();
      if (typeof patch.icon === 'string') data.icon = patch.icon.trim();
      if (typeof patch.isActive === 'boolean') data.isActive = patch.isActive;
      if (typeof patch.sortOrder === 'number') data.sortOrder = patch.sortOrder;
      const updated = await this.prisma.propertyCategory.updateMany({
        where: { id: current.id, version },
        data,
      });
      if (updated.count !== 1) throw new MasterConcurrencyError('Category version conflict');
      return this.prisma.propertyCategory.findUnique({ where: { id: current.id } });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async getCategory(uuid: string): Promise<unknown> {
    const result = await this.prisma.propertyCategory.findFirst({ where: { uuid, deletedAt: null } });
    if (!result) throw new MasterNotFoundError();
    return result;
  }

  async listCategories(query: MasterQuery): Promise<PageResult<unknown>> {
    const { page, limit, skip } = pageOf(query);
    const where: Row = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.typeUuid) where.propertyType = { uuid: query.typeUuid };
    if (query.search)
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { slug: { contains: query.search } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.propertyCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderOf(query, ['sortOrder', 'name', 'createdAt']),
      }),
      this.prisma.propertyCategory.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async deleteCategory(uuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const item = await tx.propertyCategory.findFirst({
          where: { uuid, deletedAt: null },
        });
        if (!item) throw new MasterNotFoundError();
        const used = await tx.property.count({
          where: { propertyCategoryId: item.id, deletedAt: null },
        });
        if (used) throw new MasterInUseError('Category is still referenced');
        await tx.propertyCategory.update({
          where: { id: item.id },
          data: { deletedAt: new Date(), isActive: false },
        });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  private locationDelegate(level: string): Delegate {
    return this.delegate(
      this.prisma,
      (
        {
          country: 'country',
          province: 'province',
          city: 'city',
          district: 'district',
          subdistrict: 'subdistrict',
        } as Record<string, string>
      )[level] ?? 'invalid',
    );
  }
  private parentConfig(
    level: string,
  ): { field: string; delegate: Delegate } | null {
    const map: Record<string, { field: string; key: string }> = {
      province: { field: 'countryId', key: 'country' },
      city: { field: 'provinceId', key: 'province' },
      district: { field: 'cityId', key: 'city' },
      subdistrict: { field: 'districtId', key: 'district' },
    };
    const config = map[level];
    return config
      ? { field: config.field, delegate: this.locationDelegate(config.key) }
      : null;
  }

  async createLocation(
    level: 'country' | 'province' | 'city' | 'district' | 'subdistrict',
    input: Row,
  ): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const delegate = this.delegate(tx, level);
        const parent = this.parentConfig(level);
        const data: Row = {
          code: normalizeCode(text(input.code)),
          name: text(input.name).trim(),
          slug: normalizeSlug(text(input.slug, text(input.name))),
          isActive: input.isActive !== false,
          sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 0,
        };
        if (parent) {
          const parentUuid = text(input.parentUuid);
          const parentRecord = await parent.delegate.findUnique({
            where: { uuid: parentUuid, deletedAt: null },
          });
          if (!parentRecord)
            throw new MasterHierarchyError('Parent location not found or inactive');
          data[parent.field] = row(parentRecord).id;
        }
        return delegate.create({ data });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async updateLocation(level: string, uuid: string, version: number, patch: Row): Promise<unknown> {
    if (version < 1) throw new MasterConcurrencyError('Version must be positive');
    try {
      const delegate = this.locationDelegate(level);
      const current = unwrap(await delegate.findFirst({ where: { uuid, deletedAt: null } }));
      const data: Row = {};
      const code = optionalText(patch.code);
      const name = optionalText(patch.name);
      const slug = optionalText(patch.slug);
      if (code !== null) data.code = normalizeCode(code);
      if (name !== null) data.name = name.trim();
      if (slug !== null || name !== null)
        data.slug = normalizeSlug(slug ?? name ?? text(current.name));
      if (typeof patch.isActive === 'boolean') data.isActive = patch.isActive;
      if (typeof patch.sortOrder === 'number') data.sortOrder = patch.sortOrder;
      const parent = this.parentConfig(level);
      if (parent && typeof patch.parentUuid === 'string') {
        const parentRecord = await parent.delegate.findUnique({
          where: { uuid: patch.parentUuid, deletedAt: null },
        });
        if (!parentRecord)
          throw new MasterHierarchyError('Parent location not found or inactive');
        data[parent.field] = row(parentRecord).id;
      }
      return delegate.update({ where: { uuid }, data });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async getLocation(level: string, uuid: string): Promise<unknown> {
    const result = await this.locationDelegate(level).findFirst({
      where: { uuid, deletedAt: null },
    });
    if (!result) throw new MasterNotFoundError();
    return result;
  }
  async listLocations(level: string, query: MasterQuery): Promise<PageResult<unknown>> {
    const { page, limit, skip } = pageOf(query);
    const where: Row = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    const parent = this.parentConfig(level);
    if (parent && query.parentUuid) {
      const p = await parent.delegate.findUnique({
        where: { uuid: query.parentUuid, deletedAt: null },
      });
      if (!p) throw new MasterHierarchyError('Parent location not found or inactive');
      where[parent.field] = row(p).id;
    }
    if (query.search)
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { slug: { contains: query.search } },
      ];
    const delegate = this.locationDelegate(level);
    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderOf(query, ['sortOrder', 'name', 'createdAt']),
      }),
      delegate.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  async deleteLocation(level: string, uuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const delegate = this.delegate(tx, level);
        const item = await delegate.findFirst({ where: { uuid, deletedAt: null } });
        if (!item) throw new MasterNotFoundError();
        await delegate.update({
          where: { uuid },
          data: { deletedAt: new Date(), isActive: false },
        });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async children(level: string, uuid: string): Promise<unknown[]> {
    const map: Record<string, { parentField: string; child: string }> = {
      country: { parentField: 'countryId', child: 'province' },
      province: { parentField: 'provinceId', child: 'city' },
      city: { parentField: 'cityId', child: 'district' },
      district: { parentField: 'districtId', child: 'subdistrict' },
    };
    const config = map[level];
    if (!config) throw new MasterHierarchyError('Location level has no children');
    const parent = await this.locationDelegate(level).findFirst({ where: { uuid, deletedAt: null } });
    if (!parent) throw new MasterNotFoundError();
    return this.locationDelegate(config.child).findMany({
      where: { [config.parentField]: row(parent).id, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { uuid: 'asc' }],
    });
  }

  async createFacility(input: Row): Promise<unknown> {
    try {
      return await this.prisma.facility.create({
        data: {
          uuid: randomUUID(),
          code: normalizeCode(text(input.code)),
          name: text(input.name).trim(),
          slug: normalizeSlug(text(input.slug, text(input.name))),
          category: text(input.category) as FacilityCategory,
          icon: optionalText(input.icon),
          description: optionalText(input.description),
          sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 0,
          isActive: input.isActive !== false,
        },
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async updateFacility(uuid: string, version: number, patch: Row): Promise<unknown> {
    if (version < 1) throw new MasterConcurrencyError('Version must be positive');
    try {
      const current = unwrap(await this.prisma.facility.findFirst({ where: { uuid, deletedAt: null } }));
      const data: Row = { version: { increment: 1 } };
      const code = optionalText(patch.code);
      const name = optionalText(patch.name);
      const slug = optionalText(patch.slug);
      if (code !== null) data.code = normalizeCode(code);
      if (name !== null) data.name = name.trim();
      if (slug !== null || name !== null) data.slug = normalizeSlug(slug ?? name ?? text(current.slug));
      if (typeof patch.category === 'string') data.category = patch.category;
      if (typeof patch.icon === 'string') data.icon = patch.icon.trim();
      if (typeof patch.description === 'string') data.description = patch.description.trim();
      if (typeof patch.sortOrder === 'number') data.sortOrder = patch.sortOrder;
      if (typeof patch.isActive === 'boolean') data.isActive = patch.isActive;
      const updated = await this.prisma.facility.updateMany({ where: { id: current.id, version }, data });
      if (updated.count !== 1) throw new MasterConcurrencyError('Facility version conflict');
      return this.prisma.facility.findUnique({ where: { id: current.id } });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async getFacility(uuid: string): Promise<unknown> {
    const result = await this.prisma.facility.findFirst({ where: { uuid, deletedAt: null } });
    if (!result) throw new MasterNotFoundError();
    return result;
  }
  async listFacilities(query: MasterQuery): Promise<PageResult<unknown>> {
    const { page, limit, skip } = pageOf(query);
    const where: Row = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.category) where.category = query.category;
    if (query.search)
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { slug: { contains: query.search } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.facility.findMany({ where, skip, take: limit, orderBy: orderOf(query, ['sortOrder', 'name', 'createdAt']) }),
      this.prisma.facility.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  async deleteFacility(uuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const item = await tx.facility.findFirst({ where: { uuid, deletedAt: null } });
        if (!item) throw new MasterNotFoundError();
        const used = await tx.propertyFacility.count({ where: { facilityId: item.id } });
        if (used) throw new MasterInUseError('Facility is still assigned');
        await tx.facility.update({ where: { id: item.id }, data: { deletedAt: new Date(), isActive: false } });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  private async propertyRefs(
    tx: object,
    input: Row,
  ): Promise<{
    typeId: bigint;
    categoryId: bigint;
    subcategoryId: bigint | null;
  }> {
    const client = tx as {
      propertyType: { findFirst(args: object): Promise<unknown> };
      propertyCategory: { findFirst(args: object): Promise<unknown> };
      propertySubcategory: { findFirst(args: object): Promise<unknown> };
    };
    const typeRecord = await client.propertyType.findFirst({
      where: { uuid: text(input.typeUuid), deletedAt: null, isActive: true },
    });
    if (!typeRecord)
      throw new MasterHierarchyError('Property type not found or inactive');
    const type = row(typeRecord);

    const categoryRecord = await client.propertyCategory.findFirst({
      where: {
        uuid: text(input.categoryUuid),
        deletedAt: null,
        isActive: true,
      },
    });
    if (!categoryRecord)
      throw new MasterHierarchyError('Property category not found or inactive');
    const category = row(categoryRecord);

    if (type.id !== category.propertyTypeId)
      throw new MasterHierarchyError('Category does not belong to type');

    let subcategoryId: bigint | null = null;
    if (input.subcategoryUuid) {
      const subRecord = await client.propertySubcategory.findFirst({
        where: {
          uuid: text(input.subcategoryUuid),
          deletedAt: null,
          isActive: true,
        },
      });
      if (!subRecord)
        throw new MasterHierarchyError('Property subcategory not found or inactive');
      const sub = row(subRecord);
      if (sub.propertyCategoryId !== category.id)
        throw new MasterHierarchyError('Subcategory does not belong to category');
      subcategoryId = sub.id as bigint;
    }
    return {
      typeId: type.id as bigint,
      categoryId: category.id as bigint,
      subcategoryId,
    };
  }

  private async uniqueCode(tx: object, prefix: 'EST' | 'REF'): Promise<string> {
    const client = tx as {
      property: { findUnique(args: object): Promise<unknown> };
    };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const value = `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
      const field = prefix === 'EST' ? 'businessCode' : 'referenceNumber';
      if (!(await client.property.findUnique({ where: { [field]: value } })))
        return value;
    }
    throw new MasterConflictError('Unable to allocate a unique property identifier');
  }

  async createProperty(input: Row, actor: ActorContext): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const refs = await this.propertyRefs(tx, input);
        const title = text(input.title).trim();
        if (!title) throw new MasterHierarchyError('Property title is required');
        const slug = normalizeSlug(text(input.slug, title));
        const from = dateValue(input.availableFrom);
        const to = dateValue(input.availableTo);
        if (from && to && from > to)
          throw new MasterHierarchyError('availableFrom must not be later than availableTo');
        return tx.property.create({
          data: {
            businessCode: optionalText(input.businessCode) ?? (await this.uniqueCode(tx, 'EST')),
            referenceNumber: optionalText(input.referenceNumber) ?? (await this.uniqueCode(tx, 'REF')),
            propertyTypeId: refs.typeId,
            propertyCategoryId: refs.categoryId,
            propertySubcategoryId: refs.subcategoryId,
            title,
            slug,
            shortDescription: optionalText(input.shortDescription),
            description: optionalText(input.description),
            status: text(input.status, 'DRAFT') as PropertyStatus,
            availabilityStatus: availabilityStatus(input.availabilityStatus),
            availableFrom: from,
            availableTo: to,
            version: 1,
            createdBy: actor.actorUuid ?? null,
            updatedBy: actor.actorUuid ?? null,
          },
        });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }
  async getProperty(uuid: string): Promise<unknown> {
    const r = await this.prisma.property.findFirst({
      where: { uuid, deletedAt: null },
      include: {
        propertyType: { select: { uuid: true, code: true, name: true } },
        propertyCategory: { select: { uuid: true, code: true, name: true } },
        propertySubcategory: { select: { uuid: true, code: true, name: true } },
        subdistrict: { select: { uuid: true, code: true, name: true } },
        facilities: { include: { facility: true } },
      },
    });
    if (!r) throw new MasterNotFoundError('Property not found');
    return r;
  }
  async listProperties(q: MasterQuery): Promise<PageResult<unknown>> {
    const { page, limit, skip } = pageOf(q);
    const where: Row = { deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.typeUuid) where.propertyType = { uuid: q.typeUuid };
    if (q.categoryUuid) where.propertyCategory = { uuid: q.categoryUuid };
    if (q.subcategoryUuid) where.propertySubcategory = { uuid: q.subcategoryUuid };
    if (q.search)
      where.OR = [
        { title: { contains: q.search } },
        { businessCode: { contains: q.search } },
        { referenceNumber: { contains: q.search } },
        { slug: { contains: q.search } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderOf(q, ['updatedAt', 'title', 'createdAt']),
        select: {
          uuid: true,
          businessCode: true,
          referenceNumber: true,
          title: true,
          slug: true,
          status: true,
          availabilityStatus: true,
          availableFrom: true,
          availableTo: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          propertyType: { select: { uuid: true, code: true, name: true } },
          propertyCategory: { select: { uuid: true, code: true, name: true } },
          propertySubcategory: { select: { uuid: true, code: true, name: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  async updateProperty(uuid: string, version: number, patch: Row, actor: ActorContext): Promise<unknown> {
    try {
      const rowValue = await this.prisma.property.findFirst({ where: { uuid, deletedAt: null } });
      if (!rowValue) throw new MasterNotFoundError();
      const current = row(rowValue);
      if (current.version !== version) throw new MasterConcurrencyError('Property version conflict');
      const data: Row = { version: { increment: 1 }, updatedBy: actor.actorUuid ?? current.updatedBy };
      const title = optionalText(patch.title);
      const slug = optionalText(patch.slug);
      if (title !== null) data.title = title.trim();
      if (slug !== null || title !== null) data.slug = normalizeSlug(slug ?? title ?? text(current.slug));
      if (typeof patch.shortDescription === 'string') data.shortDescription = patch.shortDescription.trim();
      if (typeof patch.description === 'string') data.description = patch.description.trim();
      if (typeof patch.status === 'string') data.status = patch.status;
      if (typeof patch.availabilityStatus === 'string') data.availabilityStatus = patch.availabilityStatus;
      if (patch.availableFrom !== undefined) data.availableFrom = dateValue(patch.availableFrom);
      if (patch.availableTo !== undefined) data.availableTo = dateValue(patch.availableTo);
      const from = (data.availableFrom as Date | null | undefined) ?? (current.availableFrom as Date | null);
      const to = (data.availableTo as Date | null | undefined) ?? (current.availableTo as Date | null);
      if (from && to && from > to) throw new MasterHierarchyError('availableFrom must not be later than availableTo');
      const updated = await this.prisma.property.updateMany({ where: { id: current.id, version }, data });
      if (updated.count !== 1) throw new MasterConcurrencyError('Property version conflict');
      return this.prisma.property.findUnique({ where: { id: current.id } });
    } catch (error: unknown) {
      mapError(error);
    }
  }
  async deleteProperty(uuid: string, actor: ActorContext): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const r = await tx.property.findFirst({ where: { uuid, deletedAt: null } });
        if (!r) throw new MasterNotFoundError();
        await tx.property.update({ where: { id: r.id }, data: { deletedAt: new Date(), deletedBy: actor.actorUuid ?? null, version: { increment: 1 } } });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }
  async restoreProperty(uuid: string, actor: ActorContext): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const r = await tx.property.findFirst({ where: { uuid } });
        if (!r) throw new MasterNotFoundError();
        if (!r.deletedAt) return r;
        return tx.property.update({ where: { id: r.id }, data: { deletedAt: null, deletedBy: null, updatedBy: actor.actorUuid ?? r.updatedBy, version: { increment: 1 } } });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }
  async duplicateProperty(uuid: string, actor: ActorContext): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const source = await tx.property.findFirst({ where: { uuid, deletedAt: null }, include: { facilities: true } });
        if (!source) throw new MasterNotFoundError();
        const businessCode = await this.uniqueCode(tx, 'EST');
        const referenceNumber = await this.uniqueCode(tx, 'REF');
        const copy = await tx.property.create({
          data: {
            businessCode,
            referenceNumber,
            propertyTypeId: source.propertyTypeId,
            propertyCategoryId: source.propertyCategoryId,
            propertySubcategoryId: source.propertySubcategoryId,
            subdistrictId: source.subdistrictId,
            title: `${source.title} (Copy)`,
            slug: normalizeSlug(`${source.slug}-copy-${randomUUID().slice(0, 8)}`),
            shortDescription: source.shortDescription,
            description: source.description,
            status: 'DRAFT',
            availabilityStatus: source.availabilityStatus,
            availableFrom: source.availableFrom,
            availableTo: source.availableTo,
            version: 1,
            createdBy: actor.actorUuid ?? null,
            updatedBy: actor.actorUuid ?? null,
          },
        });
        if (source.facilities.length)
          await tx.propertyFacility.createMany({ data: source.facilities.map((item) => ({ propertyId: copy.id, facilityId: item.facilityId })) });
        return copy;
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }
}
