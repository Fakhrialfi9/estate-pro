import type { PropertyTypeEntity } from '../domain/entities/property-type.entity.js';

export interface PropertyTypeResponse {
  uuid: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const serializePropertyType = (
  propertyType: PropertyTypeEntity,
): PropertyTypeResponse => ({
  uuid: propertyType.uuid,
  code: propertyType.code,
  name: propertyType.name,
  slug: propertyType.slug,
  description: propertyType.description,
  icon: propertyType.icon,
  isActive: propertyType.isActive,
  sortOrder: propertyType.sortOrder,
  createdAt: propertyType.createdAt.toISOString(),
  updatedAt: propertyType.updatedAt.toISOString(),
});

export const serializePropertyTypeList = (
  items: PropertyTypeEntity[],
  total: number,
  page: number,
  limit: number,
) => ({
  items: items.map(serializePropertyType),
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
});
