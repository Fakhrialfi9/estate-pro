import { PropertyTypeEntity } from '../../domain/entities/property-type.entity.js';
import type { PropertyTypeSnapshot } from '../../domain/entities/property-type.entity.js';
import type { CreatePropertyTypeData } from '../../domain/repositories/property-type.repository.js';

export interface PropertyTypePersistenceRecord extends PropertyTypeSnapshot {
  id: bigint;
}

export interface PropertyTypePersistenceData {
  code: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
}

export class PrismaPropertyTypeMapper {
  static toDomain(record: PropertyTypePersistenceRecord): PropertyTypeEntity {
    return PropertyTypeEntity.create({
      uuid: record.uuid,
      code: record.code,
      name: record.name,
      slug: record.slug,
      description: record.description,
      icon: record.icon,
      isActive: record.isActive,
      sortOrder: record.sortOrder,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  static toCreatePersistence(
    data: CreatePropertyTypeData,
  ): PropertyTypePersistenceData {
    return {
      code: data.code,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      icon: data.icon ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    };
  }
}
