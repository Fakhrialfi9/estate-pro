import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { PropertyTypeUpdate } from '../../domain/entities/property-type.entity.js';
import type {
  CreatePropertyTypeData,
  PropertyTypeFilterField,
  PropertyTypeListQuery,
  PropertyTypeListResult,
  PropertyTypeRepository,
  PropertyTypeSortField,
} from '../../domain/repositories/property-type.repository.js';
import {
  PropertyTypeAlreadyExistsException,
  PropertyTypeNotFoundException,
} from '../../domain/errors/property-type.errors.js';
import {
  PrismaPropertyTypeMapper,
  type PropertyTypePersistenceData,
  type PropertyTypePersistenceRecord,
} from './prisma-property-type.mapper.js';

type StringFilter = string | { contains: string };
type PropertyTypeWhere = {
  uuid?: string;
  code?: StringFilter;
  name?: StringFilter;
  slug?: StringFilter;
  isActive?: boolean;
  deletedAt?: Date | null;
  OR?: Array<{ code?: StringFilter; name?: StringFilter; slug?: StringFilter }>;
};
type Delegate = {
  create(args: {
    data: PropertyTypePersistenceData;
  }): Promise<PropertyTypePersistenceRecord>;
  findFirst(args: {
    where: PropertyTypeWhere;
  }): Promise<PropertyTypePersistenceRecord | null>;
  findMany(args: {
    where: PropertyTypeWhere;
    orderBy: Array<Record<string, SortDirection>>;
    skip: number;
    take: number;
  }): Promise<PropertyTypePersistenceRecord[]>;
  count(args: { where: PropertyTypeWhere }): Promise<number>;
  update(args: {
    where: { uuid: string };
    data: Partial<PropertyTypePersistenceData> & { deletedAt?: Date };
  }): Promise<PropertyTypePersistenceRecord>;
};
type PrismaPropertyTypeClient = { propertyType: Delegate };
type SortDirection = 'asc' | 'desc';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100;
const SORT_FIELDS: Readonly<Record<PropertyTypeSortField, true>> = {
  code: true,
  name: true,
  slug: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PrismaPropertyTypeRepository implements PropertyTypeRepository {
  private readonly propertyTypes: Delegate;

  constructor(prisma: PrismaService) {
    const client = prisma as unknown as PrismaPropertyTypeClient;
    this.propertyTypes = client.propertyType;
  }

  async create(data: CreatePropertyTypeData) {
    try {
      const record = await this.propertyTypes.create({
        data: PrismaPropertyTypeMapper.toCreatePersistence(data),
      });
      return PrismaPropertyTypeMapper.toDomain(record);
    } catch (error: unknown) {
      this.mapUniqueConstraint(error);
      throw error;
    }
  }

  async findById(uuid: string) {
    const record = await this.propertyTypes.findFirst({
      where: { uuid, deletedAt: null },
    });
    return record ? PrismaPropertyTypeMapper.toDomain(record) : null;
  }

  async findByCode(code: string) {
    const record = await this.propertyTypes.findFirst({
      where: { code, deletedAt: null },
    });
    return record ? PrismaPropertyTypeMapper.toDomain(record) : null;
  }

  async findBySlug(slug: string) {
    const record = await this.propertyTypes.findFirst({
      where: { slug, deletedAt: null },
    });
    return record ? PrismaPropertyTypeMapper.toDomain(record) : null;
  }

  async list(query: PropertyTypeListQuery): Promise<PropertyTypeListResult> {
    const page =
      Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
    const limit = Number.isInteger(query.limit)
      ? Math.min(Math.max(query.limit, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const sortBy = this.resolveSortField(query.sortBy);
    const sortDirection: SortDirection =
      query.sortDirection === 'desc' ? 'desc' : 'asc';
    const search = query.search?.trim().slice(0, MAX_SEARCH_LENGTH);
    const where: PropertyTypeWhere = {
      deletedAt: null,
      ...this.buildFilter(query.filterField, query.filterValue),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { name: { contains: search } },
              { slug: { contains: search } },
            ],
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      this.propertyTypes.findMany({
        where,
        orderBy: [{ [sortBy]: sortDirection }, { uuid: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.propertyTypes.count({ where }),
    ]);

    return {
      items: records.map((record) => PrismaPropertyTypeMapper.toDomain(record)),
      total,
      page,
      limit,
    };
  }

  async update(uuid: string, changes: PropertyTypeUpdate) {
    try {
      const record = await this.propertyTypes.update({
        where: { uuid },
        data: {
          ...(changes.code !== undefined ? { code: changes.code } : {}),
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.slug !== undefined ? { slug: changes.slug } : {}),
          ...(changes.description !== undefined
            ? { description: changes.description }
            : {}),
          ...(changes.icon !== undefined ? { icon: changes.icon } : {}),
          ...(changes.isActive !== undefined
            ? { isActive: changes.isActive }
            : {}),
          ...(changes.sortOrder !== undefined
            ? { sortOrder: changes.sortOrder }
            : {}),
        },
      });
      return PrismaPropertyTypeMapper.toDomain(record);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002')
        throw new PropertyTypeAlreadyExistsException('code or slug');
      if (code === 'P2025') throw new PropertyTypeNotFoundException();
      throw error;
    }
  }

  async softDelete(uuid: string, deletedAt = new Date()): Promise<void> {
    try {
      await this.propertyTypes.update({
        where: { uuid },
        data: { deletedAt, isActive: false },
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2025')
        throw new PropertyTypeNotFoundException();
      throw error;
    }
  }

  private resolveSortField(
    value: PropertyTypeSortField,
  ): PropertyTypeSortField {
    return value in SORT_FIELDS ? value : 'createdAt';
  }

  private buildFilter(
    field?: PropertyTypeFilterField,
    value?: string | boolean,
  ): PropertyTypeWhere {
    if (!field || value === undefined) return {};
    if (field === 'isActive')
      return { isActive: value === true || value === 'true' };
    return { [field]: value };
  }

  private mapUniqueConstraint(error: unknown): void {
    if ((error as { code?: string }).code === 'P2002') {
      const fields = String(
        (error as { message?: string }).message ?? '',
      ).toLowerCase();
      throw new PropertyTypeAlreadyExistsException(
        fields.includes('slug') ? 'slug' : 'code',
      );
    }
  }
}
