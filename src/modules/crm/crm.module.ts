import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { CRM_REPOSITORY } from './domain/repositories/crm.repository.js';
import { PrismaCrmRepository } from './infrastructure/persistence/prisma-crm.repository.js';
import { CrmService } from './application/crm.service.js';
import { CrmController } from './presentation/crm.controller.js';
@Module({imports:[DatabaseModule,AuditModule,AuthorizationModule],controllers:[CrmController],providers:[CrmService,{provide:CRM_REPOSITORY,useClass:PrismaCrmRepository}],exports:[CRM_REPOSITORY]})
export class CrmModule {}
