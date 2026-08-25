import {
  ForbiddenPermissionOperationException,
  SystemPermissionProtectedException,
} from '../../domain/errors/permission.errors.js';
import { isProtectedPermissionCode } from '../../domain/entities/permission.entity.js';

export interface PermissionActor {
  userUuid: string;
  permissions: readonly string[];
}

export const PERMISSION_READ_PERMISSION = 'permissions:read';
export const PERMISSION_MANAGE_PERMISSION = 'permissions:manage';
export const PERMISSION_PROTECTED_MANAGE_PERMISSION =
  'permissions:manage:protected';

export class PermissionAuthorizationPolicy {
  canRead(actor: PermissionActor): void {
    if (
      !actor.permissions.includes(PERMISSION_READ_PERMISSION) &&
      !actor.permissions.includes(PERMISSION_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenPermissionOperationException();
    }
  }

  canManage(actor: PermissionActor, code?: string): void {
    if (!actor.permissions.includes(PERMISSION_MANAGE_PERMISSION)) {
      throw new ForbiddenPermissionOperationException();
    }
    if (code !== undefined && isProtectedPermissionCode(code)) {
      this.canManageProtected(actor);
    }
  }

  canManageProtected(actor: PermissionActor): void {
    if (!actor.permissions.includes(PERMISSION_PROTECTED_MANAGE_PERMISSION)) {
      throw new SystemPermissionProtectedException();
    }
  }

  canModifyIdentifier(): never {
    throw new SystemPermissionProtectedException();
  }
}
