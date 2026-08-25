import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenClaims,
  type AccessTokenVerifier,
} from './access-token-verifier.port.js';
import {
  AUTHENTICATION_SESSION_PORT,
  type AuthenticationSessionPort,
} from './authentication-session.port.js';

export type AuthenticatedRequest = Request & { user?: AccessTokenClaims };

@Injectable()
export class AuthenticatedAccessGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly accessTokenVerifier: AccessTokenVerifier,
    @Inject(AUTHENTICATION_SESSION_PORT)
    private readonly sessions: AuthenticationSessionPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    try {
      const claims = await this.accessTokenVerifier.verifyAccessToken(token);
      const active = await this.sessions.isActive(
        claims.sub,
        claims.sid,
        new Date(),
      );
      if (!active) throw new UnauthorizedException();

      request.user = claims;
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid authentication token');
    }
  }
}
