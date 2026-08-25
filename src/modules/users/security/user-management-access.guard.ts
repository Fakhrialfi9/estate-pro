import {
  ForbiddenException,
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
import { Inject } from '@nestjs/common';
import { UserManagementService } from '../application/services/user-management.service.js';

type AuthenticatedRequest = Request & { user?: AccessTokenClaims };

@Injectable()
export class UserManagementAccessGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly users: UserManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    try {
      const claims = await this.accessTokenVerifier.verifyAccessToken(token);
      const actor = await this.users.getByUuid(claims.sub);
      if (!actor.isAccessible()) throw new UnauthorizedException();
      request.user = claims;

      const pathUuid = request.params['uuid'];
      const permissions = new Set(claims.permissions ?? []);
      const isOwnResource =
        typeof pathUuid === 'string' && pathUuid === claims.sub;
      const method = request.method.toUpperCase();
      const requiresManagement =
        !isOwnResource || !['GET', 'HEAD'].includes(method);

      if (requiresManagement && !permissions.has('users:manage'))
        throw new ForbiddenException();
      return true;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException();
    }
  }
}
