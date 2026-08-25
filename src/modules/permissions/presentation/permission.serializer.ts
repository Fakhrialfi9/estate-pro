import type { PermissionEntity } from '../domain/entities/permission.entity.js';

export interface PermissionResponse {
  id: string;
  name: string;
  code: string;
  resource: string;
  module: string;
  domain: string;
  action: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PermissionSerializer = {
  one(permission: PermissionEntity): PermissionResponse {
    return {
      id: permission.uuid,
      name: permission.name,
      code: permission.code,
      resource: permission.resource,
      module: permission.module,
      domain: permission.domain,
      action: permission.action,
      isSystem: permission.isSystem,
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    };
  },
  list(items: PermissionEntity[], total: number, page: number, limit: number) {
    return {
      data: items.map((permission) => PermissionSerializer.one(permission)),
      meta: { total, page, limit, pageCount: Math.ceil(total / limit) },
    };
  },
};
