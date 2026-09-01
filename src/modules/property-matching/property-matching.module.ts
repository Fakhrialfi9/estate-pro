import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { MatchingEngine } from './domain/matching-engine.js';
import { MATCHING_REPOSITORY } from './application/matching.ports.js';
import { PropertyMatchingService } from './application/property-matching.service.js';
import { PrismaPropertyMatchingRepository } from './infrastructure/prisma-property-matching.repository.js';
import { PropertyMatchingController } from './presentation/property-matching.controller.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorizationModule],
  controllers: [PropertyMatchingController],
  providers: [MatchingEngine, PropertyMatchingService, { provide: MATCHING_REPOSITORY, useClass: PrismaPropertyMatchingRepository }],
  exports: [PropertyMatchingService],
})
export class PropertyMatchingModule {}