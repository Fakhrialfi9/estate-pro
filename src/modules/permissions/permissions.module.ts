import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PERMISSION_REPOSITORY } from './domain/repositories/permission.repository.js';
import { PrismaPermissionRepository } from './infrastructure/persistence/prisma-permission.repository.js';
import { PermissionAuthorizationPolicy } from './application/policies/permission-authorization.policy.js';
import { PermissionService } from './application/services/permission.service.js';
import { PermissionsController } from './presentation/permissions.controller.js';
import {
  PermissionReadAccessGuard,
  PermissionManageAccessGuard,
} from './security/permission-management-access.guard.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PermissionsController],
  providers: [
    PermissionService,
    PermissionAuthorizationPolicy,
    PermissionReadAccessGuard,
    PermissionManageAccessGuard,
    {
      provide: PERMISSION_REPOSITORY,
      useClass: PrismaPermissionRepository,
    },
  ],
  exports: [PermissionService, PERMISSION_REPOSITORY],
})
export class PermissionsModule {}
