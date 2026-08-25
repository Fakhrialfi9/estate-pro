import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository.js';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository.js';
import { RoleService } from './application/services/role.service.js';
import { RoleAuthorizationPolicy } from './application/policies/role-authorization.policy.js';
import { RolesController } from './presentation/roles.controller.js';
import {
  RoleReadAccessGuard,
  RoleManageAccessGuard,
} from './security/role-management-access.guard.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RolesController],
  providers: [
    RoleService,
    RoleAuthorizationPolicy,
    RoleReadAccessGuard,
    RoleManageAccessGuard,
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
  ],
  exports: [RoleService, ROLE_REPOSITORY],
})
export class RolesModule {}
