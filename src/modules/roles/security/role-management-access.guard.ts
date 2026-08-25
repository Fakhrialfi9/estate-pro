import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  ROLE_MANAGE_PERMISSION,
  ROLE_READ_PERMISSION,
} from '../application/policies/role-authorization.policy.js';

interface RoleClaims {
  sub: string;
  permissions?: string[];
}
export type RoleAuthenticatedRequest = Request & { user?: RoleClaims };

abstract class BaseRoleAccessGuard implements CanActivate {
  protected abstract readonly requiredPermission: string;

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RoleAuthenticatedRequest>();
    if (!request.user?.sub) throw new UnauthorizedException();
    if (!(request.user.permissions ?? []).includes(this.requiredPermission))
      throw new ForbiddenException();
    return true;
  }
}

@Injectable()
export class RoleReadAccessGuard extends BaseRoleAccessGuard {
  protected readonly requiredPermission = ROLE_READ_PERMISSION;

  override canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RoleAuthenticatedRequest>();
    if (!request.user?.sub) throw new UnauthorizedException();
    const permissions = new Set(request.user.permissions ?? []);
    if (
      !permissions.has(ROLE_READ_PERMISSION) &&
      !permissions.has(ROLE_MANAGE_PERMISSION)
    )
      throw new ForbiddenException();
    return true;
  }
}

@Injectable()
export class RoleManageAccessGuard extends BaseRoleAccessGuard {
  protected readonly requiredPermission = ROLE_MANAGE_PERMISSION;
}
