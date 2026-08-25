import { Module } from '@nestjs/common';
import { AuthenticatedAccessGuard } from '../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AuthorizationService } from '../../common/security/authorization.service.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository.js';
import { PrismaRolePermissionRepository } from './infrastructure/persistence/prisma-role-permission.repository.js';
import { PrismaUserRoleRepository } from './infrastructure/persistence/prisma-user-role.repository.js';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository.js';
import { ROLE_PERMISSION_REPOSITORY } from './domain/repositories/role-permission.repository.js';
import { USER_ROLE_REPOSITORY } from './domain/repositories/user-role.repository.js';
import { USER_ROLE_TARGET_REPOSITORY } from './domain/repositories/user-role-target.repository.js';
import { RoleService } from './application/services/role.service.js';
import { RolePermissionService } from './application/services/role-permission.service.js';
import { UserRoleService } from './application/services/user-role.service.js';
import { RoleAuthorizationPolicy } from './application/policies/role-authorization.policy.js';
import { RolesController } from './presentation/roles.controller.js';
import { UserRolesController } from './presentation/user-roles.controller.js';
import {
  RoleReadAccessGuard,
  RoleManageAccessGuard,
} from './security/role-management-access.guard.js';

@Module({
  imports: [DatabaseModule, PermissionsModule],
  controllers: [RolesController, UserRolesController],
  providers: [
    AuthenticatedAccessGuard,
    AuthorizationGuard,
    AuthorizationService,
    RoleService,
    RolePermissionService,
    UserRoleService,
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
    {
      provide: USER_ROLE_REPOSITORY,
      useClass: PrismaUserRoleRepository,
    },
    {
      provide: USER_ROLE_TARGET_REPOSITORY,
      useClass: PrismaUserRoleTargetRepository,
    },
  ],
  exports: [RoleService, ROLE_REPOSITORY, UserRoleService, AuthorizationGuard],
})
export class RolesModule {}
