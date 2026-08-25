import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  PERMISSION_MANAGE_PERMISSION,
  PERMISSION_READ_PERMISSION,
} from '../application/policies/permission-authorization.policy.js';

interface PermissionClaims {
  sub: string;
  permissions?: string[];
}

export type PermissionAuthenticatedRequest = Request & {
  user?: PermissionClaims;
};

abstract class BasePermissionAccessGuard implements CanActivate {
  protected abstract readonly requiredPermission: string;

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<PermissionAuthenticatedRequest>();
    if (!request.user?.sub) throw new UnauthorizedException();
    if (!(request.user.permissions ?? []).includes(this.requiredPermission)) {
      throw new ForbiddenException();
    }
    return true;
  }
}

@Injectable()
export class PermissionReadAccessGuard extends BasePermissionAccessGuard {
  protected readonly requiredPermission = PERMISSION_READ_PERMISSION;

  override canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<PermissionAuthenticatedRequest>();
    if (!request.user?.sub) throw new UnauthorizedException();
    const permissions = new Set(request.user.permissions ?? []);
    if (
      !permissions.has(PERMISSION_READ_PERMISSION) &&
      !permissions.has(PERMISSION_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenException();
    }
    return true;
  }
}

@Injectable()
export class PermissionManageAccessGuard extends BasePermissionAccessGuard {
  protected readonly requiredPermission = PERMISSION_MANAGE_PERMISSION;
}
