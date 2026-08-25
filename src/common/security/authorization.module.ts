import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuthorizationService } from './authorization.service.js';
import { USER_AUTHORIZATION_REPOSITORY } from './authorization.repository.js';
import { PrismaUserAuthorizationRepository } from '../../modules/roles/infrastructure/persistence/prisma-user-authorization.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    AuthorizationService,
    {
      provide: USER_AUTHORIZATION_REPOSITORY,
      useClass: PrismaUserAuthorizationRepository,
    },
  ],
  exports: [AuthorizationService, USER_AUTHORIZATION_REPOSITORY],
})
export class AuthorizationModule {}
