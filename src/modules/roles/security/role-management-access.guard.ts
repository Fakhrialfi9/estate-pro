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
} from '../../../common/security/authorization.repository.js';

interface RoleClaims {
  sub: string;
  permissions?: string[];
}
export type RoleAuthenticatedRequest = Request & { user?: RoleClaims };

abstract class BaseRoleAccessGuard implements CanActivate {
  protected abstract readonly requiredPermission: string;

  protected constructor(
    protected readonly authorization: UserAuthorizationRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RoleAuthenticatedRequest>();
    if (!request.user?.sub) throw new UnauthorizedException();

    const snapshot = await this.authorization.getAuthorizationSnapshot(
      request.user.sub,
    );
    if (!snapshot) throw new UnauthorizedException();
    request.user.permissions = [...snapshot.permissionCodes];

    if (!snapshot.permissionCodes.includes(this.requiredPermission)) {
      throw new ForbiddenException();
    }
    return true;
  }
}

@Injectable()
export class RoleReadAccessGuard extends BaseRoleAccessGuard {
  protected readonly requiredPermission = ROLE_READ_PERMISSION;

  constructor(
    @Inject(USER_AUTHORIZATION_REPOSITORY)
    authorization: UserAuthorizationRepository,
  ) {
    super(authorization);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RoleAuthenticatedRequest>();
    if (!request.user?.sub) throw new UnauthorizedException();

    const snapshot = await this.authorization.getAuthorizationSnapshot(
      request.user.sub,
    );
    if (!snapshot) throw new UnauthorizedException();
    request.user.permissions = [...snapshot.permissionCodes];

    const permissionSet = new Set(snapshot.permissionCodes);
    if (
      !permissionSet.has(ROLE_READ_PERMISSION) &&
      !permissionSet.has(ROLE_MANAGE_PERMISSION)
    ) {
      throw new ForbiddenException();
    }
    return true;
  }
}

@Injectable()
export class RoleManageAccessGuard extends BaseRoleAccessGuard {
  protected readonly requiredPermission = ROLE_MANAGE_PERMISSION;

  constructor(
    @Inject(USER_AUTHORIZATION_REPOSITORY)
    authorization: UserAuthorizationRepository,
  ) {
    super(authorization);
  }
}
