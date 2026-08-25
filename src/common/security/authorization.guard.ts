import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  AUTHORIZATION_PERMISSIONS_METADATA,
  AUTHORIZATION_PUBLIC_METADATA,
  AUTHORIZATION_ROLES_METADATA,
  type AuthorizationRequirement,
} from './authorization.decorators.js';
import { AuthorizationService } from './authorization.service.js';

type AuthorizationRequest = Request & {
  user?: {
    sub?: string;
    permissions?: string[];
  };
};

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      AUTHORIZATION_PUBLIC_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) return true;

    const permissions =
      this.reflector.getAllAndOverride<AuthorizationRequirement>(
        AUTHORIZATION_PERMISSIONS_METADATA,
        [context.getHandler(), context.getClass()],
      );
    const roles = this.reflector.getAllAndOverride<AuthorizationRequirement>(
      AUTHORIZATION_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!permissions && !roles) throw new ForbiddenException();

    const request = context.switchToHttp().getRequest<AuthorizationRequest>();
    const userUuid = request.user?.sub;
    if (!userUuid) throw new UnauthorizedException();

    try {
      const snapshot = await this.authorization.resolve(userUuid);
      if (permissions) {
        this.authorization.assertPermissions(
          snapshot,
          permissions.values,
          permissions.match,
        );
      }
      if (roles) {
        this.authorization.assertRoles(snapshot, roles.values, roles.match);
      }

      request.user = {
        ...request.user,
        sub: snapshot.userUuid,
        permissions: [...snapshot.permissionCodes],
      };
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ForbiddenException();
    }
  }
}
