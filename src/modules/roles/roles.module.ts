import { Module } from '@nestjs/common';
import { AuthenticatedAccessGuard } from '../../common/security/authenticated-access.guard.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository.js';
import { PrismaRolePermissionRepository } from './infrastructure/persistence/prisma-role-permission.repository.js';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository.js';
import { ROLE_PERMISSION_REPOSITORY } from './domain/repositories/role-permission.repository.js';
import { RoleService } from './application/services/role.service.js';
import { RolePermissionService } from './application/services/role-permission.service.js';
import { RoleAuthorizationPolicy } from './application/policies/role-authorization.policy.js';
import { RolesController } from './presentation/roles.controller.js';
import {
  RoleReadAccessGuard,
  RoleManageAccessGuard,
} from './security/role-management-access.guard.js';

@Module({
  imports: [DatabaseModule, PermissionsModule],
  controllers: [RolesController],
  providers: [
    AuthenticatedAccessGuard,
    RoleService,
    RolePermissionService,
    RoleAuthorizationPolicy,
    RoleReadAccessGuard,
    RoleManageAccessGuard,
    {
      provide: ROLE_REPOSITORY,
      useClass: PrismaRoleRepository,
    },
    {
      provide: ROLE_PERMISSION_REPOSITORY,
      useClass: PrismaRolePermissionRepository,
    },
  ],
  exports: [RoleService, ROLE_REPOSITORY],
})
export class RolesModule {}
