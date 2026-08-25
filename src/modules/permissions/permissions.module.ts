import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AuthorizationService } from '../../common/security/authorization.service.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PERMISSION_REPOSITORY } from './domain/repositories/permission.repository.js';
import type { PermissionRepository } from './domain/repositories/permission.repository.js';
import { PermissionNotFoundException } from './domain/errors/permission.errors.js';
import { PrismaPermissionRepository } from './infrastructure/persistence/prisma-permission.repository.js';
import { PermissionAuthorizationPolicy } from './application/policies/permission-authorization.policy.js';
import { PermissionService } from './application/services/permission.service.js';
import { PermissionsController } from './presentation/permissions.controller.js';
import {
  PermissionReadAccessGuard,
  PermissionManageAccessGuard,
} from './security/permission-management-access.guard.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [PermissionsController],
  providers: [
    AuthorizationGuard,
    AuthorizationService,
    PermissionService,
    PermissionAuthorizationPolicy,
    PermissionReadAccessGuard,
    PermissionManageAccessGuard,
    { provide: PERMISSION_REPOSITORY, useClass: PrismaPermissionRepository },
  ],
  exports: [
    PermissionService,
    PermissionAuthorizationPolicy,
    PERMISSION_REPOSITORY,
    AuthorizationGuard,
    AuthorizationService,
  ],
})
export class PermissionsModule {}

export {
  PERMISSION_REPOSITORY,
  PermissionAuthorizationPolicy,
  PermissionNotFoundException,
};
export type { PermissionRepository };
