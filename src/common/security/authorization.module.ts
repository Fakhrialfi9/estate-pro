import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuthorizationService } from './authorization.service.js';
import { USER_AUTHORIZATION_REPOSITORY } from './authorization.repository.js';
import { PropertyAccessGuard } from './property-access.guard.js';

@Module({
  imports: [DatabaseModule],
  providers: [AuthorizationService, PropertyAccessGuard],
  exports: [
    AuthorizationService,
    USER_AUTHORIZATION_REPOSITORY,
    PropertyAccessGuard,
  ],
})
export class AuthorizationModule {}
