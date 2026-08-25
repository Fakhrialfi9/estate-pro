import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { USER_REPOSITORY } from './domain/repositories/user.repository.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository.js';
import { UserManagementService } from './application/services/user-management.service.js';
import { UsersController } from './presentation/users.controller.js';
import { UserManagementAccessGuard } from './security/user-management-access.guard.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [UsersController],
  providers: [
    UserManagementService,
    UserManagementAccessGuard,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [UserManagementService],
})
export class UsersModule {}
