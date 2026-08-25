import type { RoleEntity } from '../domain/entities/role.entity.js';
import type { PermissionEntity } from '../../permissions/domain/entities/permission.entity.js';
import type { RolePermissionListResult } from '../domain/repositories/role-permission.repository.js';

export const RolePermissionSerializer = {
  assignment(role: RoleEntity, permission: PermissionEntity) {
    return {
      role: {
        id: role.uuid,
        name: role.name,
      },
      permission: {
        id: permission.uuid,
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        identifier: permission.code,
      },
    };
  },

  list(role: RoleEntity, result: RolePermissionListResult) {
    return {
      role: {
        id: role.uuid,
        name: role.name,
      },
      permissions: result.items.map((permission) => ({
        id: permission.uuid,
        name: permission.name,
        resource: `${permission.module}:${permission.domain}`,
        action: permission.action,
        identifier: permission.code,
      })),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    };
  },
};
