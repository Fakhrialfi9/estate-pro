import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { CRM_REPOSITORY } from './domain/repositories/crm.repository.js';
import { PrismaCrmRepository } from './infrastructure/persistence/prisma-crm.repository.js';
import { CrmService } from './application/crm.service.js';
import { CrmLifecycleService } from './application/crm-lifecycle.service.js';
import { CrmController } from './presentation/crm.controller.js';
import { CrmPublicInquiryController } from './presentation/crm-public-inquiry.controller.js';
import { CrmLifecycleController } from './presentation/crm-lifecycle.controller.js';
@Module({imports:[DatabaseModule,AuditModule,AuthorizationModule],controllers:[CrmController,CrmPublicInquiryController,CrmLifecycleController],providers:[CrmService,CrmLifecycleService,{provide:CRM_REPOSITORY,useClass:PrismaCrmRepository}],exports:[CRM_REPOSITORY,CrmService]})
export class CrmModule {}
