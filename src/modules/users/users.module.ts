import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { USER_REPOSITORY } from './domain/repositories/user.repository.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository.js';
import { UserManagementService } from './application/services/user-management.service.js';
import { UsersController } from './presentation/users.controller.js';
import { UserManagementAccessGuard } from './security/user-management-access.guard.js';
import { USER_PROFILE_REPOSITORY } from './profile/domain/repositories/user-profile.repository.js';
import { PrismaUserProfileRepository } from './profile/infrastructure/persistence/prisma-user-profile.repository.js';
import { UserProfileService } from './profile/application/services/user-profile.service.js';
import { UserProfileOwnershipPolicy } from './profile/application/policies/user-profile-ownership.policy.js';
import { UserProfileController } from './profile/presentation/user-profile.controller.js';
import { ProfileAuthenticationGuard } from './profile/security/profile-authentication.guard.js';
import { USER_IDENTITY_READER } from './profile/application/types/user-identity-reader.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController, UserProfileController],
  providers: [
    UserManagementService,
    UserManagementAccessGuard,
    UserProfileService,
    UserProfileOwnershipPolicy,
    ProfileAuthenticationGuard,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: USER_PROFILE_REPOSITORY,
      useClass: PrismaUserProfileRepository,
    },
    {
      provide: USER_IDENTITY_READER,
      useExisting: UserManagementService,
    },
  ],
  exports: [UserManagementService],
})
export class UsersModule {}
