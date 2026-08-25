import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PasswordHasherService } from '../../common/security/password-hasher.service.js';
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
import { CREDENTIAL_REPOSITORY } from './credentials/domain/repositories/credential.repository.js';
import { PrismaCredentialRepository } from './credentials/infrastructure/persistence/prisma-credential.repository.js';
import { CredentialService } from './credentials/application/services/credential.service.js';
import {
  PASSWORD_RESET_DELIVERY,
  PasswordResetService,
} from './credentials/application/services/password-reset.service.js';
import { ConfiguredPasswordResetDeliveryService } from './credentials/application/services/configured-password-reset-delivery.service.js';
import { CredentialsController } from './credentials/presentation/credentials.controller.js';
import { serializeUser } from './application/serializers/user.serializer.js';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [UsersController, UserProfileController, CredentialsController],
  providers: [
    UserManagementService,
    UserManagementAccessGuard,
    UserProfileService,
    UserProfileOwnershipPolicy,
    ProfileAuthenticationGuard,
    CredentialService,
    PasswordResetService,
    ConfiguredPasswordResetDeliveryService,
    PasswordHasherService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: USER_PROFILE_REPOSITORY, useClass: PrismaUserProfileRepository },
    { provide: CREDENTIAL_REPOSITORY, useClass: PrismaCredentialRepository },
    {
      provide: PASSWORD_RESET_DELIVERY,
      useExisting: ConfiguredPasswordResetDeliveryService,
    },
    { provide: USER_IDENTITY_READER, useExisting: UserManagementService },
  ],
  exports: [
    UserManagementService,
    CredentialService,
    PasswordResetService,
    USER_REPOSITORY,
    CREDENTIAL_REPOSITORY,
    PasswordHasherService,
  ],
})
export class UsersModule {}

export { USER_REPOSITORY } from './domain/repositories/user.repository.js';
export type { UserRepository } from './domain/repositories/user.repository.js';
export { CREDENTIAL_REPOSITORY } from './credentials/domain/repositories/credential.repository.js';
export type { CredentialRepository } from './credentials/domain/repositories/credential.repository.js';
export { UserManagementService, serializeUser };
