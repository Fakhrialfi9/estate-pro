import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { PropertyModule } from '../property/property.module.js';
import { UsersModule } from '../users/users.module.js';
import { CRM_REPOSITORY } from './domain/repositories/crm.repository.js';
import { PrismaCrmRepository } from './infrastructure/persistence/prisma-crm.repository.js';
import { CrmService } from './application/crm.service.js';
import { CrmLifecycleService } from './application/crm-lifecycle.service.js';
import { CrmController } from './presentation/crm.controller.js';
import { CrmPublicInquiryController } from './presentation/crm-public-inquiry.controller.js';
import { CrmLifecycleController } from './presentation/crm-lifecycle.controller.js';
import { ScoreDomainService } from './application/ports/score-domain.service.js';
import { DuplicateDetector } from './application/ports/duplicate-detector.js';
import { LeadMergePolicy } from './application/ports/merge.policy.js';

@Module({
  imports:[DatabaseModule,AuditModule,AuthorizationModule,PropertyModule,UsersModule],
  controllers:[CrmController,CrmPublicInquiryController,CrmLifecycleController],
  providers:[CrmService,CrmLifecycleService,ScoreDomainService,DuplicateDetector,LeadMergePolicy,{provide:CRM_REPOSITORY,useClass:PrismaCrmRepository}],
  exports:[CRM_REPOSITORY,CrmService],
})
export class CrmModule {}
