import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { PrismaPropertyAccessQuery } from '../../infrastructure/authorization/prisma-property-access.query.js';
import { AuthorizationService } from './authorization.service.js';
import { PropertyAccessGuard } from './property-access.guard.js';
import { PROPERTY_ACCESS_QUERY } from './property-access.port.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    AuthorizationService,
    PropertyAccessGuard,
    {
      provide: PROPERTY_ACCESS_QUERY,
      useClass: PrismaPropertyAccessQuery,
    },
  ],
  exports: [AuthorizationService, PropertyAccessGuard],
})
export class AuthorizationModule {}
