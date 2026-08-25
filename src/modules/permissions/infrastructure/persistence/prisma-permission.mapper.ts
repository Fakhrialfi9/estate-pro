import {
  isProtectedPermissionCode,
  PermissionEntity,
} from '../../domain/entities/permission.entity.js';

export interface PermissionPersistenceRecord {
  uuid: string;
  name: string;
  code: string;
  module: string;
  domain: string;
  action: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionPersistenceData {
  name?: string;
  code?: string;
  module?: string;
  domain?: string;
  action?: string;
}

export const PrismaPermissionMapper = {
  toDomain(record: PermissionPersistenceRecord): PermissionEntity {
    return PermissionEntity.create({
      uuid: record.uuid,
      name: record.name,
      code: record.code,
      module: record.module,
      domain: record.domain,
      action: record.action,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
  isSystem(record: PermissionPersistenceRecord): boolean {
    return isProtectedPermissionCode(record.code);
  },
  toPersistence(data: PermissionPersistenceData): PermissionPersistenceData {
    return { ...data };
  },
};
