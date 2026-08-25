import { ConfigService } from '@nestjs/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../application/types/authenticated-principal.js';
import type { UserIdentityReader } from '../application/types/user-identity-reader.js';
import { USER_IDENTITY_READER } from '../application/types/user-identity-reader.js';
import { Inject } from '@nestjs/common';

export type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Injectable()
export class ProfileAuthenticationGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(USER_IDENTITY_READER) private readonly users: UserIdentityReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    try {
      const claims = await this.jwt.verifyAsync<AuthenticatedPrincipal>(token, {
        secret: this.config.getOrThrow<string>('auth.jwt.secret'),
        issuer: this.config.getOrThrow<string>('auth.jwt.issuer'),
        audience: this.config.getOrThrow<string>('auth.jwt.audience'),
        algorithms: [
          this.config.getOrThrow<'HS256' | 'HS384' | 'HS512'>(
            'auth.jwt.algorithm',
          ),
        ],
      });

      if (!claims.sub) throw new UnauthorizedException();
      const actor = await this.users.getByUuid(claims.sub);
      if (!actor.isAccessible()) throw new UnauthorizedException();
      request.user = claims;
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException();
    }
  }
}
