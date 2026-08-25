import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  ROLE_MANAGE_PERMISSION,
  ROLE_READ_PERMISSION,
} from '../application/policies/role-authorization.policy.js';
import {
  USER_AUTHORIZATION_REPOSITORY,
  type UserAuthorizationRepository,
} from '../domain/repositories/user-authorization.repository.js';

interface RoleClaims {
  sub: string;
  permissions?: string[];
}
export type RoleAuthenticatedRequest = Request & { user?: RoleClaims };

abstract class BaseRoleAccessGuard implements CanActivate {
  protected abstract readonly requiredPermission: string;

  protected constructor(
    protected readonly authorization?: UserAuthorizationRepository,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RoleAuthenticatedRequest>();
    if (!request.user?.sub) throw new UnauthorizedException();

    const tokenPermissions = request.user.permissions;
    if (tokenPermissions !== undefined) {
      if (!tokenPermissions.includes(this.requiredPermission)) {
        throw new ForbiddenException();
      }
      return true;
    }

    if (!this.authorization) throw new ForbiddenException();
    return this.authorization
      .listPermissionCodes(request.user.sub)
      .then((permissions) => {
        request.user!.permissions = [...permissions];
        if (!permissions.includes(this.requiredPermission)) {
          throw new ForbiddenException();
        }
        return true;
      });
  }
}

@Injectable()
export class RoleReadAccessGuard extends BaseRoleAccessGuard {
  protected readonly requiredPermission = ROLE_READ_PERMISSION;

  constructor(
    @Inject(USER_AUTHORIZATION_REPOSITORY)
    authorization?: UserAuthorizationRepository,
  ) {
    super(authorization);
  }

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RoleAuthenticatedRequest>();
    if (!request.user?.sub) throw new UnauthorizedException();

    const tokenPermissions = request.user.permissions;
    if (tokenPermissions !== undefined) {
      const permissions = new Set(tokenPermissions);
      if (
        !permissions.has(ROLE_READ_PERMISSION) &&
        !permissions.has(ROLE_MANAGE_PERMISSION)
      ) {
        throw new ForbiddenException();
      }
      return true;
    }

    if (!this.authorization) throw new ForbiddenException();
    return this.authorization
      .listPermissionCodes(request.user.sub)
      .then((permissions) => {
        request.user!.permissions = [...permissions];
        const permissionSet = new Set(permissions);
        if (
          !permissionSet.has(ROLE_READ_PERMISSION) &&
          !permissionSet.has(ROLE_MANAGE_PERMISSION)
        ) {
          throw new ForbiddenException();
        }
        return true;
      });
  }
}

@Injectable()
export class RoleManageAccessGuard extends BaseRoleAccessGuard {
  protected readonly requiredPermission = ROLE_MANAGE_PERMISSION;

  constructor(
    @Inject(USER_AUTHORIZATION_REPOSITORY)
    authorization?: UserAuthorizationRepository,
  ) {
    super(authorization);
  }
}
