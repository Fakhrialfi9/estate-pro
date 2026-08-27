import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module.js';
import { AuthorizationModule } from '../../../common/security/authorization.module.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { DatabaseModule } from '../../../infrastructure/database/database.module.js';
import { LISTING_REPOSITORY } from './domain/listing.repository.js';
import { PrismaListingRepository } from './infrastructure/listing.repository.js';
import { ListingService } from './application/listing.service.js';
import { ListingController } from './presentation/listing.controller.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorizationModule],
  controllers: [ListingController],
  providers: [
    AuthorizationGuard,
    ListingService,
    { provide: LISTING_REPOSITORY, useClass: PrismaListingRepository },
  ],
  exports: [LISTING_REPOSITORY, ListingService],
})
export class ListingModule {}
