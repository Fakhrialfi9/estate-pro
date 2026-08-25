import { Module } from '@nestjs/common';

import { DatabaseHealthService } from './database-health.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaUserAuthorizationRepository } from './authorization/prisma-user-authorization.repository.js';
import { USER_AUTHORIZATION_REPOSITORY } from '../../common/security/authorization.repository.js';

@Module({
  imports: [PrismaModule],
  providers: [
    DatabaseHealthService,
    {
      provide: USER_AUTHORIZATION_REPOSITORY,
      useClass: PrismaUserAuthorizationRepository,
    },
  ],
  exports: [PrismaModule, DatabaseHealthService, USER_AUTHORIZATION_REPOSITORY],
})
export class DatabaseModule {}
