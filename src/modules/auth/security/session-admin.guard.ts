import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenClaims } from '../application/services/jwt-token.service.js';

type AuthenticatedRequest = Request & { user?: AccessTokenClaims };

@Injectable()
export class SessionAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const permissions = new Set(request.user?.permissions ?? []);
    if (!permissions.has('sessions:manage')) throw new ForbiddenException();
    return true;
  }
}
