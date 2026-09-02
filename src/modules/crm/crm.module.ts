import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { PropertyModule } from '../property/property.module.js';
import { UsersModule } from '../users/users.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { CRM_REPOSITORY } from './domain/repositories/crm.repository.js';
import { PrismaCrmRepository } from './infrastructure/persistence/prisma-crm.repository.js';
import { PrismaCrmLifecycleRepository } from './infrastructure/persistence/prisma-crm-lifecycle.repository.js';
import { CrmService } from './application/crm.service.js';
import { CrmLifecycleService } from './application/crm-lifecycle.service.js';
import { CrmAutomationAdapter } from './application/services/crm-automation.adapter.js';
import { CrmController } from './presentation/crm.controller.js';
import { CrmPublicInquiryController } from './presentation/crm-public-inquiry.controller.js';
import { CrmLifecycleController } from './presentation/crm-lifecycle.controller.js';
import { ScoreDomainService } from './application/ports/score-domain.service.js';
import { DuplicateDetector } from './application/ports/duplicate-detector.js';
import { LeadMergePolicy } from './application/ports/merge.policy.js';
import { LeadLifecyclePolicy } from './domain/lead-lifecycle.policy.js';
import { QualificationPolicy } from './domain/qualification.policy.js';
import { ClosurePolicy } from './domain/closure.policy.js';
import { CRM_AUTOMATION_PORT } from '../../common/contracts/automation-crm.port.js';
import { CRM_AGENT_WORKLOAD_PORT } from '../../common/contracts/crm-agent-workload.port.js';
import { PrismaCrmAgentWorkloadAdapter } from './crm-agent-workload.adapter.js';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    AuthorizationModule,
    PropertyModule,
    UsersModule,
    SalesModule,
  ],
  controllers: [
    CrmController,
    CrmPublicInquiryController,
    CrmLifecycleController,
  ],
  providers: [
    CrmService,
    CrmAutomationAdapter,
    CrmLifecycleService,
    PrismaCrmLifecycleRepository,
    ScoreDomainService,
    DuplicateDetector,
    LeadMergePolicy,
    LeadLifecyclePolicy,
    QualificationPolicy,
    ClosurePolicy,
    { provide: CRM_REPOSITORY, useClass: PrismaCrmRepository },
    { provide: CRM_AUTOMATION_PORT, useExisting: CrmAutomationAdapter },
    {
      provide: CRM_AGENT_WORKLOAD_PORT,
      useClass: PrismaCrmAgentWorkloadAdapter,
    },
  ],
  exports: [
    CRM_REPOSITORY,
    CrmService,
    CRM_AUTOMATION_PORT,
    CRM_AGENT_WORKLOAD_PORT,
  ],
})
export class CrmModule {}
