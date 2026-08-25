import { ForbiddenRoleOperationException, SystemRoleProtectedException } from '../../domain/errors/role.errors.js';

export interface RoleActor {
  userUuid: string;
  permissions: readonly string[];
}

export const ROLE_READ_PERMISSION = 'roles:read';
export const ROLE_MANAGE_PERMISSION = 'roles:manage';
export const ROLE_PROTECTED_MANAGE_PERMISSION = 'roles:manage:protected';

export class RoleAuthorizationPolicy {
  canRead(actor: RoleActor): void {
    if (!actor.permissions.includes(ROLE_READ_PERMISSION) && !actor.permissions.includes(ROLE_MANAGE_PERMISSION)) {
      throw new ForbiddenRoleOperationException();
    }
  }

  canManage(actor: RoleActor, isProtected = false): void {
    if (!actor.permissions.includes(ROLE_MANAGE_PERMISSION)) {
      throw new ForbiddenRoleOperationException();
    }
    if (isProtected && !actor.permissions.includes(ROLE_PROTECTED_MANAGE_PERMISSION)) {
      throw new SystemRoleProtectedException();
    }
  }

  canModifyProtected(actor: RoleActor): void {
    if (!actor.permissions.includes(ROLE_PROTECTED_MANAGE_PERMISSION)) {
      throw new SystemRoleProtectedException();
    }
  }
}
