import {
  ForbiddenPermissionOperationException,
  SystemPermissionProtectedException,
} from '../../domain/errors/permission.errors.js';
import { isProtectedPermissionCode } from '../../domain/entities/permission.entity.js';

export interface PermissionActor {
  userUuid: string;
  permissions: readonly string[];
}

export const PERMISSION_READ_PERMISSION = 'permissions.read';
export const PERMISSION_CREATE_PERMISSION = 'permissions.create';
export const PERMISSION_UPDATE_PERMISSION = 'permissions.update';
export const PERMISSION_DELETE_PERMISSION = 'permissions.delete';
export const PERMISSION_MANAGE_PERMISSION = 'permissions.manage';
export const PERMISSION_PROTECTED_MANAGE_PERMISSION =
  'permissions.manage.protected';

const normalizePermissionCode = (permission: string): string =>
  permission.trim().replace(/:/g, '.');

export class PermissionAuthorizationPolicy {
  canRead(actor: PermissionActor): void {
    if (
      !this.hasPermission(actor, PERMISSION_READ_PERMISSION) &&
      !this.hasPermission(actor, PERMISSION_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenPermissionOperationException();
    }
  }

  canManage(actor: PermissionActor, code?: string): void {
    const requiredPermission =
      code ?? PERMISSION_MANAGE_PERMISSION;
    if (
      !this.hasPermission(actor, requiredPermission) &&
      !this.hasPermission(actor, PERMISSION_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenPermissionOperationException();
    }
    if (
      code !== undefined &&
      isProtectedPermissionCode(code) &&
      !this.hasPermission(actor, PERMISSION_PROTECTED_MANAGE_PERMISSION)
    ) {
      throw new SystemPermissionProtectedException();
    }
  }

  canManageProtected(actor: PermissionActor): void {
    if (!this.hasPermission(actor, PERMISSION_PROTECTED_MANAGE_PERMISSION)) {
      throw new SystemPermissionProtectedException();
    }
  }

  canModifyIdentifier(): never {
    throw new SystemPermissionProtectedException();
  }

  private hasPermission(actor: PermissionActor, required: string): boolean {
    const normalizedRequired = normalizePermissionCode(required);
    return actor.permissions.some(
      (permission) => normalizePermissionCode(permission) === normalizedRequired,
    );
  }
}
