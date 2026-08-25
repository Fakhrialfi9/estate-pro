import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtTokenService } from '../application/services/jwt-token.service.js';
import type { AccessTokenClaims } from '../application/services/jwt-token.service.js';
import type { AuthenticationSessionRepository } from '../domain/repositories/authentication-session.repository.js';
import { AUTHENTICATION_SESSION_REPOSITORY } from '../domain/repositories/authentication-session.repository.js';

export type AuthenticatedRequest = Request & { user?: AccessTokenClaims };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtTokenService,
    @Inject(AUTHENTICATION_SESSION_REPOSITORY)
    private readonly sessions: AuthenticationSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    const claims = await this.jwt.verifyAccessToken(token);
    const active = await this.sessions.isActive(
      claims.sub,
      claims.sid,
      new Date(),
    );
    if (!active) throw new UnauthorizedException('Invalid authentication token');

    request.user = claims;
    return true;
  }
}
