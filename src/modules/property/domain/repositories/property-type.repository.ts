import type {
  PropertyTypeEntity,
  PropertyTypeUpdate,
} from '../entities/property-type.entity.js';

export interface CreatePropertyTypeData {
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export type PropertyTypeFilterField = 'code' | 'name' | 'slug' | 'isActive';
export type PropertyTypeSortField =
  | 'code'
  | 'name'
  | 'slug'
  | 'isActive'
  | 'sortOrder'
  | 'createdAt'
  | 'updatedAt';

export interface PropertyTypeListQuery {
  page: number;
  limit: number;
  filterField?: PropertyTypeFilterField;
  filterValue?: string | boolean;
  sortBy: PropertyTypeSortField;
  sortDirection: 'asc' | 'desc';
  search?: string;
}

export interface PropertyTypeListResult {
  items: PropertyTypeEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface PropertyTypeRepository {
  create(data: CreatePropertyTypeData): Promise<PropertyTypeEntity>;
  findById(uuid: string): Promise<PropertyTypeEntity | null>;
  findByCode(code: string): Promise<PropertyTypeEntity | null>;
  findBySlug(slug: string): Promise<PropertyTypeEntity | null>;
  list(query: PropertyTypeListQuery): Promise<PropertyTypeListResult>;
  update(uuid: string, changes: PropertyTypeUpdate): Promise<PropertyTypeEntity>;
  softDelete(uuid: string, deletedAt?: Date): Promise<void>;
}

export const PROPERTY_TYPE_REPOSITORY = Symbol('PROPERTY_TYPE_REPOSITORY');
