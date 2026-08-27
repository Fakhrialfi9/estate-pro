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
  return [
    { [field]: q.sortDirection === 'desc' ? 'desc' : 'asc' },
    { uuid: 'asc' },
  ];
};
const availabilityStatus = (value: unknown): AvailabilityStatus => {
  const status = text(value, 'AVAILABLE');
  if (status === 'AVAILABLE' || status === 'UNAVAILABLE') return status;
  throw new MasterHierarchyError('Invalid availability status');
};

@Injectable()
export class PrismaPropertyMasterStore implements PropertyMasterRepository {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(tx: object, level: string): Delegate {
    const client = tx as Record<string, unknown>;
    const value = client[level];
    if (!value || typeof value !== 'object')
      throw new MasterHierarchyError('Invalid master level');
    return value as Delegate;
  }

  async createCategory(input: {
    typeUuid: string;
    code: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const typeRecord = await tx.propertyType.findFirst({
          where: { uuid: input.typeUuid, deletedAt: null, isActive: true },
        });
        if (!typeRecord)
          throw new MasterHierarchyError('Property type not found or inactive');
        return tx.propertyCategory.create({
          data: {
            propertyTypeId: typeRecord.id,
            code: normalizeCode(input.code),
            name: input.name.trim(),
            slug: normalizeSlug(input.slug || input.name),
            description: optionalText(input.description),
            icon: optionalText(input.icon),
            isActive: input.isActive ?? true,
            sortOrder: input.sortOrder ?? 0,
          },
        });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async updateCategory(uuid: string, version: number, patch: Row): Promise<unknown> {
    try {
      if (version < 1) throw new MasterConcurrencyError('Version must be positive');
      const current = await this.prisma.propertyCategory.findFirst({
        where: { uuid, deletedAt: null },
      });
      if (!current) throw new MasterNotFoundError('Property category not found');
      const data: Row = {};
      const code = optionalText(patch.code);
      const name = optionalText(patch.name);
      const slug = optionalText(patch.slug);
      if (code !== null) data.code = normalizeCode(code);
      if (name !== null) data.name = name.trim();
      if (slug !== null || name !== null)
        data.slug = normalizeSlug(slug ?? name ?? current.name);
      if (typeof patch.description === 'string') data.description = patch.description.trim();
      if (typeof patch.icon === 'string') data.icon = patch.icon.trim();
      if (typeof patch.isActive === 'boolean') data.isActive = patch.isActive;
      if (typeof patch.sortOrder === 'number') data.sortOrder = patch.sortOrder;
      return await this.prisma.propertyCategory.update({ where: { id: current.id }, data });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async getCategory(uuid: string): Promise<unknown> {
    const result = await this.prisma.propertyCategory.findFirst({ where: { uuid, deletedAt: null } });
    if (!result) throw new MasterNotFoundError('Property category not found');
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
      this.prisma.propertyCategory.findMany({ where, skip, take: limit, orderBy: orderOf(query, ['sortOrder', 'name', 'createdAt']) }),
      this.prisma.propertyCategory.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async deleteCategory(uuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const category = await tx.propertyCategory.findFirst({ where: { uuid, deletedAt: null } });
        if (!category) throw new MasterNotFoundError();
        const [children, properties] = await Promise.all([
          tx.propertySubcategory.count({ where: { propertyCategoryId: category.id, deletedAt: null } }),
          tx.property.count({ where: { propertyCategoryId: category.id, deletedAt: null } }),
        ]);
        if (children || properties) throw new MasterInUseError('Category is still referenced');
        await tx.propertyCategory.update({ where: { id: category.id }, data: { deletedAt: new Date(), isActive: false } });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async createSubcategory(input: {
    categoryUuid: string;
    code: string;
    name: string;
    slug: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.propertyCategory.findFirst({ where: { uuid: input.categoryUuid, deletedAt: null, isActive: true } });
        if (!category) throw new MasterHierarchyError('Category not found or inactive');
        return tx.propertySubcategory.create({
          data: {
            propertyCategoryId: category.id,
            code: normalizeCode(input.code),
            name: input.name.trim(),
            slug: normalizeSlug(input.slug || input.name),
            description: optionalText(input.description),
            isActive: input.isActive ?? true,
            sortOrder: input.sortOrder ?? 0,
          },
        });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async updateSubcategory(uuid: string, version: number, patch: Row): Promise<unknown> {
    try {
      if (version < 1) throw new MasterConcurrencyError('Version must be positive');
      const current = await this.prisma.propertySubcategory.findFirst({ where: { uuid, deletedAt: null } });
      if (!current) throw new MasterNotFoundError();
      const data: Row = {};
      const code = optionalText(patch.code);
      const name = optionalText(patch.name);
      const slug = optionalText(patch.slug);
      if (code !== null) data.code = normalizeCode(code);
      if (name !== null) data.name = name.trim();
      if (slug !== null || name !== null) data.slug = normalizeSlug(slug ?? name ?? current.name);
      if (typeof patch.description === 'string') data.description = patch.description.trim();
      if (typeof patch.isActive === 'boolean') data.isActive = patch.isActive;
      if (typeof patch.sortOrder === 'number') data.sortOrder = patch.sortOrder;
      return await this.prisma.propertySubcategory.update({ where: { id: current.id }, data });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async getSubcategory(uuid: string): Promise<unknown> {
    const result = await this.prisma.propertySubcategory.findFirst({ where: { uuid, deletedAt: null } });
    if (!result) throw new MasterNotFoundError();
    return result;
  }

  async listSubcategories(query: MasterQuery): Promise<PageResult<unknown>> {
    const { page, limit, skip } = pageOf(query);
    const where: Row = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.categoryUuid) where.propertyCategory = { uuid: query.categoryUuid };
    if (query.search)
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { slug: { contains: query.search } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.propertySubcategory.findMany({ where, skip, take: limit, orderBy: orderOf(query, ['sortOrder', 'name', 'createdAt']) }),
      this.prisma.propertySubcategory.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async deleteSubcategory(uuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const item = await tx.propertySubcategory.findFirst({ where: { uuid, deletedAt: null } });
        if (!item) throw new MasterNotFoundError();
        const used = await tx.property.count({ where: { propertySubcategoryId: item.id, deletedAt: null } });
        if (used) throw new MasterInUseError('Subcategory is still referenced');
        await tx.propertySubcategory.update({ where: { id: item.id }, data: { deletedAt: new Date(), isActive: false } });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  private locationDelegate(level: string): Delegate {
    return this.delegate(this.prisma, ({ country: 'country', province: 'province', city: 'city', district: 'district', subdistrict: 'subdistrict' } as Record<string, string>)[level] ?? 'invalid');
  }
  private parentConfig(level: string): { field: string; delegate: Delegate } | null {
    const map: Record<string, { field: string; key: string }> = {
      province: { field: 'countryId', key: 'country' }, city: { field: 'provinceId', key: 'province' },
      district: { field: 'cityId', key: 'city' }, subdistrict: { field: 'districtId', key: 'district' },
    };
    const config = map[level];
    return config ? { field: config.field, delegate: this.locationDelegate(config.key) } : null;
  }

  async createLocation(level: 'country' | 'province' | 'city' | 'district' | 'subdistrict', input: Row): Promise<unknown> {
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
          const parentRecord = await parent.delegate.findUnique({ where: { uuid: parentUuid, deletedAt: null } });
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
      if (slug !== null || name !== null) data.slug = normalizeSlug(slug ?? name ?? text(current.name));
      if (typeof patch.isActive === 'boolean') data.isActive = patch.isActive;
      if (typeof patch.sortOrder === 'number') data.sortOrder = patch.sortOrder;
      const parent = this.parentConfig(level);
      if (parent && typeof patch.parentUuid === 'string') {
        const parentRecord = row(await parent.delegate.findUnique({ where: { uuid: patch.parentUuid, deletedAt: null } }));
        data[parent.field] = parentRecord.id;
      }
      return delegate.update({ where: { uuid }, data });
    } catch (error: unknown) {
      mapError(error);
    }
  }

  async getLocation(level: string, uuid: string): Promise<unknown> {
    const result = await this.locationDelegate(level).findFirst({ where: { uuid, deletedAt: null } });
    if (!result) throw new MasterNotFoundError();
    return result;
  }
  async listLocations(level: string, query: MasterQuery): Promise<PageResult<unknown>> {
    const { page, limit, skip } = pageOf(query);
    const where: Row = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    const parent = this.parentConfig(level);
    if (parent && query.parentUuid) {
      const p = row(await parent.delegate.findUnique({ where: { uuid: query.parentUuid, deletedAt: null } }));
      where[parent.field] = p.id;
    }
    if (query.search) where.OR = [{ name: { contains: query.search } }, { code: { contains: query.search } }, { slug: { contains: query.search } }];
    const delegate = this.locationDelegate(level);
    const [items, total] = await Promise.all([
      delegate.findMany({ where, skip, take: limit, orderBy: orderOf(query, ['sortOrder', 'name', 'createdAt']) }),
      delegate.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  async deleteLocation(level: string, uuid: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const delegate = this.delegate(tx, level);
        const item = row(await delegate.findFirst({ where: { uuid, deletedAt: null } }));
        const childCounts: Record<string, number> = {
          country: await tx.province.count({ where: { countryId: item.id as bigint, deletedAt: null } }),
          province: await tx.city.count({ where: { provinceId: item.id as bigint, deletedAt: null } }),
          city: await tx.district.count({ where: { cityId: item.id as bigint, deletedAt: null } }),
          district: await tx.subdistrict.count({ where: { districtId: item.id as bigint, deletedAt: null } }),
          subdistrict: await tx.property.count({ where: { subdistrictId: item.id as bigint, deletedAt: null } }),
        };
        if (childCounts[level]) throw new MasterInUseError('Location has dependent records');
        await delegate.update({ where: { uuid }, data: { deletedAt: new Date(), isActive: false } });
      });
    } catch (error: unknown) {
      mapError(error);
    }
  }
  async children(level: string, uuid: string): Promise<readonly unknown[]> {
    const config: Record<string, { child: string; fk: string }> = {
      country: { child: 'province', fk: 'countryId' }, province: { child: 'city', fk: 'provinceId' },
      city: { child: 'district', fk: 'cityId' }, district: { child: 'subdistrict', fk: 'districtId' },
    };
    const c = config[level];
    if (!c) throw new MasterHierarchyError('Invalid parent level');
    const parent = row(await this.locationDelegate(level).findFirst({ where: { uuid, deletedAt: null } }));
    return this.locationDelegate(c.child).findMany({ where: { [c.fk]: parent.id, deletedAt: null }, orderBy: { sortOrder: 'asc' } });
  }

  async createFacility(input: { code: string; name: string; slug: string; category: FacilityCategory; icon?: string; description?: string; sortOrder?: number; isActive?: boolean }): Promise<unknown> {
    try {
      return await this.prisma.facility.create({ data: { code: normalizeCode(input.code), name: input.name.trim(), slug: normalizeSlug(input.slug || input.name), category: input.category, icon: optionalText(input.icon), description: optionalText(input.description), sortOrder: input.sortOrder ?? 0, isActive: input.isActive ?? true } });
    } catch (error: unknown) {
      mapError(error);
    }
  }
  async updateFacility(uuid: string, version: number, patch: Row): Promise<unknown> {
    try {
      if (version < 1) throw new MasterConcurrencyError();
      const current = unwrap(await this.prisma.facility.findFirst({ where: { uuid, deletedAt: null } }));
      const data: Row = {};
      const code = optionalText(patch.code); const name = optionalText(patch.name); const slug = optionalText(patch.slug);
      if (code !== null) data.code = normalizeCode(code);
      if (name !== null) data.name = name.trim();
      if (slug !== null || name !== null) data.slug = normalizeSlug(slug ?? name ?? text(current.name));
      if (typeof patch.category === 'string') data.category = patch.category;
      if (typeof patch.icon === 'string') data.icon = patch.icon.trim();
      if (typeof patch.description === 'string') data.description = patch.description.trim();
      if (typeof patch.sortOrder === 'number') data.sortOrder = patch.sortOrder;
      if (typeof patch.isActive === 'boolean') data.isActive = patch.isActive;
      const id = current.id;
      if (typeof id !== 'number' && typeof id !== 'bigint') throw new MasterNotFoundError('Facility id is invalid');
      return this.prisma.facility.update({ where: { id }, data });
    } catch (error: unknown) {
      mapError(error);
    }
  }
  async getFacility(uuid: string): Promise<unknown> {
    const r = await this.prisma.facility.findFirst({ where: { uuid, deletedAt: null } });
    if (!r) throw new MasterNotFoundError();
    return r;
  }
  async listFacilities(query: MasterQuery): Promise<PageResult<unknown>> {
    const { page, limit, skip } = pageOf(query); const where: Row = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.category) where.category = query.category;
    if (query.search) where.OR = [{ name: { contains: query.search } }, { code: { contains: query.search } }, { slug: { contains: query.search } }];
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

  private async propertyRefs(tx: object, input: Row): Promise<{ typeId: bigint; categoryId: bigint; subcategoryId: bigint | null }> {
    const client = tx as {
      propertyType: { findFirst(args: object): Promise<unknown> };
      propertyCategory: { findFirst(args: object): Promise<unknown> };
      propertySubcategory: { findFirst(args: object): Promise<unknown> };
    };
    const type = row(await client.propertyType.findFirst({ where: { uuid: text(input.typeUuid), deletedAt: null, isActive: true } }));
    const category = row(await client.propertyCategory.findFirst({ where: { uuid: text(input.categoryUuid), deletedAt: null, isActive: true } }));
    if (type && category && type.id !== category.propertyTypeId)
      throw new MasterHierarchyError('Category does not belong to type');
    let subcategoryId: bigint | null = null;
    if (input.subcategoryUuid) {
      const sub = row(await client.propertySubcategory.findFirst({ where: { uuid: text(input.subcategoryUuid), deletedAt: null, isActive: true } }));
      if (sub.propertyCategoryId !== category.id)
        throw new MasterHierarchyError('Subcategory does not belong to category');
      subcategoryId = sub.id as bigint;
    }
    return { typeId: type.id as bigint, categoryId: category.id as bigint, subcategoryId };
  }
  private async uniqueCode(tx: object, prefix: 'EST' | 'REF'): Promise<string> {
    const client = tx as { property: { findUnique(args: object): Promise<unknown> } };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const value = `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
      const field = prefix === 'EST' ? 'businessCode' : 'referenceNumber';
      if (!(await client.property.findUnique({ where: { [field]: value } }))) return value;
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
        const from = dateValue(input.availableFrom); const to = dateValue(input.availableTo);
        if (from && to && from > to) throw new MasterHierarchyError('availableFrom must not be later than availableTo');
        return tx.property.create({ data: {
          businessCode: optionalText(input.businessCode) ?? (await this.uniqueCode(tx, 'EST')),
          referenceNumber: optionalText(input.referenceNumber) ?? (await this.uniqueCode(tx, 'REF')),
          propertyTypeId: refs.typeId,
          propertyCategoryId: refs.categoryId,
          propertySubcategoryId: refs.subcategoryId,
          title, slug,
          shortDescription: optionalText(input.shortDescription),
          description: optionalText(input.description),
          status: text(input.status, 'DRAFT') as PropertyStatus,
          availabilityStatus: availabilityStatus(input.availabilityStatus),
          availableFrom: from, availableTo: to, version: 1,
          createdBy: actor.actorUuid ?? null, updatedBy: actor.actorUuid ?? null,
        } });
      });
    } catch (error: unknown) { mapError(error); }
  }
  async getProperty(uuid: string): Promise<unknown> {
    const r = await this.prisma.property.findFirst({ where: { uuid, deletedAt: null }, include: {
      propertyType: { select: { uuid: true, code: true, name: true } },
      propertyCategory: { select: { uuid: true, code: true, name: true } },
      propertySubcategory: { select: { uuid: true, code: true, name: true } },
      subdistrict: { select: { uuid: true, code: true, name: true } },
      facilities: { include: { facility: true } },
    } });
    if (!r) throw new MasterNotFoundError('Property not found'); return r;
  }
  async listProperties(q: MasterQuery): Promise<PageResult<unknown>> {
    const { page, limit, skip } = pageOf(q); const where: Row = { deletedAt: null };
    if (q.status) where.status = q.status; if (q.typeUuid) where.propertyType = { uuid: q.typeUuid };
    if (q.categoryUuid) where.propertyCategory = { uuid: q.categoryUuid }; if (q.subcategoryUuid) where.propertySubcategory = { uuid: q.subcategoryUuid };
    if (q.search) where.OR = [{ title: { contains: q.search } }, { businessCode: { contains: q.search } }, { referenceNumber: { contains: q.search } }, { slug: { contains: q.search } }];
    const [items, total] = await Promise.all([this.prisma.property.findMany({ where, skip, take: limit, orderBy: orderOf(q, ['updatedAt', 'title', 'createdAt']), select: {
      uuid: true, businessCode: true, referenceNumber: true, title: true, slug: true, status: true, availabilityStatus: true,
      availableFrom: true, availableTo: true, version: true, createdAt: true, updatedAt: true,
      propertyType: { select: { uuid: true, code: true, name: true } }, propertyCategory: { select: { uuid: true, code: true, name: true } },
      propertySubcategory: { select: { uuid: true, code: true, name: true } },
    } }), this.prisma.property.count({ where })]);
    return { items, total, page, limit };
  }
  async updateProperty(uuid: string, version: number, patch: Row, actor: ActorContext): Promise<unknown> {
    try {
      const current = await this.prisma.property.findFirst({ where: { uuid, deletedAt: null } });
      if (!current) throw new MasterNotFoundError(); if (current.version !== version) throw new MasterConcurrencyError('Property version conflict');
      const data: Row = { version: { increment: 1 }, updatedBy: actor.actorUuid ?? current.updatedBy };
      const title = optionalText(patch.title); const slug = optionalText(patch.slug);
      if (title !== null) data.title = title.trim(); if (slug !== null || title !== null) data.slug = normalizeSlug(slug ?? title ?? current.slug);
      if (typeof patch.shortDescription === 'string') data.shortDescription = patch.shortDescription.trim();
      if (typeof patch.description === 'string') data.description = patch.description.trim();
      if (typeof patch.status === 'string') data.status = patch.status;
      if (typeof patch.availabilityStatus === 'string') data.availabilityStatus = patch.availabilityStatus;
      if (patch.availableFrom !== undefined) data.availableFrom = dateValue(patch.availableFrom); if (patch.availableTo !== undefined) data.availableTo = dateValue(patch.availableTo);
      const from = (data.availableFrom as Date | null | undefined) ?? current.availableFrom; const to = (data.availableTo as Date | null | undefined) ?? current.availableTo;
      if (from && to && from > to) throw new MasterHierarchyError('availableFrom must not be later than availableTo');
      const updated = await this.prisma.property.updateMany({ where: { id: current.id, version }, data });
      if (updated.count !== 1) throw new MasterConcurrencyError('Property version conflict');
      return this.prisma.property.findUnique({ where: { id: current.id } });
    } catch (error: unknown) { mapError(error); }
  }
  async deleteProperty(uuid: string, actor: ActorContext): Promise<void> {
    try { await this.prisma.$transaction(async (tx) => { const r = await tx.property.findFirst({ where: { uuid, deletedAt: null } }); if (!r) throw new MasterNotFoundError(); await tx.property.update({ where: { id: r.id }, data: { deletedAt: new Date(), deletedBy: actor.actorUuid ?? null, version: { increment: 1 } } }); }); } catch (error: unknown) { mapError(error); }
  }
  async restoreProperty(uuid: string, actor: ActorContext): Promise<unknown> {
    try { return await this.prisma.$transaction(async (tx) => { const r = await tx.property.findFirst({ where: { uuid } }); if (!r) throw new MasterNotFoundError(); if (!r.deletedAt) return r; return tx.property.update({ where: { id: r.id }, data: { deletedAt: null, deletedBy: null, updatedBy: actor.actorUuid ?? r.updatedBy, version: { increment: 1 } } }); }); } catch (error: unknown) { mapError(error); }
  }
  async duplicateProperty(uuid: string, actor: ActorContext): Promise<unknown> {
    try { return await this.prisma.$transaction(async (tx) => { const source = await tx.property.findFirst({ where: { uuid, deletedAt: null }, include: { facilities: true } }); if (!source) throw new MasterNotFoundError(); const businessCode = await this.uniqueCode(tx, 'EST'); const referenceNumber = await this.uniqueCode(tx, 'REF'); const copy = await tx.property.create({ data: { businessCode, referenceNumber, propertyTypeId: source.propertyTypeId, propertyCategoryId: source.propertyCategoryId, propertySubcategoryId: source.propertySubcategoryId, subdistrictId: source.subdistrictId, title: `${source.title} (Copy)`, slug: normalizeSlug(`${source.slug}-copy-${randomUUID().slice(0, 8)}`), shortDescription: source.shortDescription, description: source.description, status: 'DRAFT', availabilityStatus: source.availabilityStatus, availableFrom: source.availableFrom, availableTo: source.availableTo, version: 1, createdBy: actor.actorUuid ?? null, updatedBy: actor.actorUuid ?? null } }); if (source.facilities.length) await tx.propertyFacility.createMany({ data: source.facilities.map((item) => ({ propertyId: copy.id, facilityId: item.facilityId })) }); return copy; }); } catch (error: unknown) { mapError(error); }
  }
}
