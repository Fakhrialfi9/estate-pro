import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { UserManagementService } from '../application/services/user-management.service.js';

interface AuthClaims {
  sub: string;
  permissions?: string[];
}

type AuthenticatedRequest = Request & { user?: AuthClaims };

@Injectable()
export class UserManagementAccessGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UserManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    try {
      const claims = await this.jwt.verifyAsync<AuthClaims>(token, {
        secret: this.config.getOrThrow<string>('auth.jwt.secret'),
        issuer: this.config.getOrThrow<string>('auth.jwt.issuer'),
        audience: this.config.getOrThrow<string>('auth.jwt.audience'),
        algorithms: [
          this.config.getOrThrow<'HS256' | 'HS384' | 'HS512'>(
            'auth.jwt.algorithm',
          ),
        ],
      });

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
