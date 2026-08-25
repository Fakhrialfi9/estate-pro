import {
  isProtectedRoleCode,
  RoleEntity,
} from '../../domain/entities/role.entity.js';

export interface RolePersistenceRecord {
  uuid: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePersistenceData {
  name?: string;
  code?: string;
  description?: string | null;
  isActive?: boolean;
}

export const PrismaRoleMapper = {
  toDomain(record: RolePersistenceRecord): RoleEntity {
    return RoleEntity.create({
      uuid: record.uuid,
      name: record.name,
      code: record.code,
      description: record.description,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      isSystem: isProtectedRoleCode(record.code),
    });
  },
  toPersistence(data: RolePersistenceData): RolePersistenceData {
    return { ...data };
  },
};
