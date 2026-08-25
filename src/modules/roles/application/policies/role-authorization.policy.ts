import {
  ForbiddenRoleOperationException,
  SystemRoleProtectedException,
} from '../../domain/errors/role.errors.js';

export interface RoleActor {
  userUuid: string;
  permissions: readonly string[];
}

export const ROLE_READ_PERMISSION = 'roles.read';
export const ROLE_CREATE_PERMISSION = 'roles.create';
export const ROLE_UPDATE_PERMISSION = 'roles.update';
export const ROLE_DELETE_PERMISSION = 'roles.delete';
export const ROLE_MANAGE_PERMISSION = 'roles.manage';
export const ROLE_PROTECTED_MANAGE_PERMISSION = 'roles.manage.protected';

const normalizePermissionCode = (permission: string): string =>
  permission.trim().replace(/:/g, '.');

export class RoleAuthorizationPolicy {
  canRead(actor: RoleActor): void {
    if (
      !this.hasPermission(actor, ROLE_READ_PERMISSION) &&
      !this.hasPermission(actor, ROLE_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenRoleOperationException();
    }
  }

  canManage(
    actor: RoleActor,
    requiredPermissionOrProtected: string | boolean = ROLE_MANAGE_PERMISSION,
    isProtected = false,
  ): void {
    const requiredPermission =
      typeof requiredPermissionOrProtected === 'boolean'
        ? ROLE_MANAGE_PERMISSION
        : requiredPermissionOrProtected;
    const protectedRole =
      typeof requiredPermissionOrProtected === 'boolean'
        ? requiredPermissionOrProtected
        : isProtected;

    if (
      !this.hasPermission(actor, requiredPermission) &&
      !this.hasPermission(actor, ROLE_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenRoleOperationException();
    }

    if (
      protectedRole &&
      !this.hasPermission(actor, ROLE_PROTECTED_MANAGE_PERMISSION)
    ) {
      throw new SystemRoleProtectedException();
    }
  }

  canModifyProtected(actor: RoleActor): void {
    if (!this.hasPermission(actor, ROLE_PROTECTED_MANAGE_PERMISSION)) {
      throw new SystemRoleProtectedException();
    }
  }

  private hasPermission(actor: RoleActor, required: string): boolean {
    const normalizedRequired = normalizePermissionCode(required);
    return actor.permissions.some(
      (permission) =>
        typeof permission === 'string' &&
        normalizePermissionCode(permission) === normalizedRequired,
    );
  }
}
