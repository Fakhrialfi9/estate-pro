import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTHORIZATION_PUBLIC_METADATA } from '../../../../common/security/authorization.decorators.js';
import { SystemOperationsService } from '../services/system-operations.service.js';

@Injectable()
export class SystemReadOnlyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly operations: SystemOperationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      path?: string;
      originalUrl?: string;
      route?: { path?: string };
    }>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      AUTHORIZATION_PUBLIC_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) return true;

    const path =
      request.path ?? request.route?.path ?? request.originalUrl ?? '';
    if (
      path.startsWith('/api/v1/auth/') ||
      path.startsWith('/api/v1/health/') ||
      path.startsWith('/api/v1/system/operations')
    ) {
      return true;
    }

    const state = await this.operations.state();
    if (state.maintenanceMode || state.readOnlyMode) {
      throw new ServiceUnavailableException({
        code: 'SYSTEM_READ_ONLY',
        message: 'System is temporarily not accepting mutating operations.',
      });
    }
    return true;
  }
}
