import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenClaims,
  type AccessTokenVerifier,
} from '../../../../../common/security/access-token-verifier.port.js';
import {
  AUTHENTICATION_SESSION_PORT,
  type AuthenticationSessionPort,
} from '../../../../../common/security/authentication-session.port.js';
import { USER_IDENTITY_READER } from '../application/types/user-identity-reader.js';
import type { UserIdentityReader } from '../application/types/user-identity-reader.js';

export type AuthenticatedRequest = Request & { user?: AccessTokenClaims };

@Injectable()
export class ProfileAuthenticationGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly jwt: AccessTokenVerifier,
    @Inject(AUTHENTICATION_SESSION_PORT)
    private readonly sessions: AuthenticationSessionPort,
    @Inject(USER_IDENTITY_READER) private readonly users: UserIdentityReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    try {
      const claims = await this.jwt.verifyAccessToken(token);
      if (!(await this.sessions.isActive(claims.sub, claims.sid, new Date())))
        throw new UnauthorizedException();
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
