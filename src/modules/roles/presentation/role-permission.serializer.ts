import type {
  RolePermissionAssignmentView,
} from '../application/services/role-permission.service.js';
import type { RoleEntity } from '../domain/entities/role.entity.js';
import type { RolePermissionListResult } from '../domain/repositories/role-permission.repository.js';

export const RolePermissionSerializer = {
  assignment(result: RolePermissionAssignmentView) {
    return {
      role: {
        id: result.role.uuid,
        name: result.role.name,
      },
      permission: {
        id: result.permission.uuid,
        name: result.permission.name,
        resource: `${result.permission.module}:${result.permission.domain}`,
        action: result.permission.action,
        identifier: result.permission.code,
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
