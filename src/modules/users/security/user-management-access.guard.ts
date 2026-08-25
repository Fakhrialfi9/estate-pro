import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenClaims,
  type AccessTokenVerifier,
} from '../../../common/security/access-token-verifier.port.js';
import {
  USER_AUTHORIZATION_REPOSITORY,
  type UserAuthorizationRepository,
} from '../../../common/security/authorization.repository.js';
import { UserManagementService } from '../application/services/user-management.service.js';
import { USER_MANAGEMENT_PERMISSIONS } from '../application/constants/user-management-permissions.js';

type AuthenticatedRequest = Request & { user?: AccessTokenClaims };

@Injectable()
export class UserManagementAccessGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly accessTokenVerifier: AccessTokenVerifier,
    @Inject(USER_AUTHORIZATION_REPOSITORY)
    private readonly authorization: UserAuthorizationRepository,
    private readonly users: UserManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const claims = await this.authenticate(request);

    const actor = await this.users.getByUuid(claims.sub);
    if (!actor.isAccessible()) throw new UnauthorizedException();

    const snapshot = await this.authorization.getAuthorizationSnapshot(
      claims.sub,
    );
    if (!snapshot) throw new UnauthorizedException();

    const effectiveClaims: AccessTokenClaims = {
      ...claims,
      permissions: [...snapshot.permissionCodes],
    };
    request.user = effectiveClaims;

    this.authorize(request, effectiveClaims);
    return true;
  }

  private async authenticate(
    request: AuthenticatedRequest,
  ): Promise<AccessTokenClaims> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    try {
      return await this.accessTokenVerifier.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException();
    }
  }

  private authorize(
    request: AuthenticatedRequest,
    claims: AccessTokenClaims,
  ): void {
    const pathUuid = request.params['uuid'];
    const method = request.method.toUpperCase();
    const isOwnResource =
      typeof pathUuid === 'string' && pathUuid === claims.sub;
    const isReadOperation = method === 'GET' || method === 'HEAD';

    if (isOwnResource && isReadOperation) return;

    const requiredPermission = this.permissionForMethod(method);
    const permissions = new Set(claims.permissions ?? []);

    if (!permissions.has(requiredPermission)) {
      throw new ForbiddenException();
    }
  }

  private permissionForMethod(method: string): string {
    const permission =
      USER_MANAGEMENT_PERMISSIONS[
        method as keyof typeof USER_MANAGEMENT_PERMISSIONS
      ];

    if (!permission) throw new ForbiddenException();
    return permission;
  }
}
