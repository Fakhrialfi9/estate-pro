import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { SALES_REPOSITORY } from './domain/repositories/sales.repository.js';
import { PrismaSalesRepository } from './infrastructure/persistence/prisma-sales.repository.js';
import { SalesService } from './application/sales.service.js';
import { SalesAutomationAdapter } from './application/services/sales-automation.adapter.js';
import { SalesController } from './presentation/sales.controller.js';
import './presentation/sales-openapi.js';
import { SALES_CONVERSION_PORT } from '../../common/contracts/sales-conversion.port.js';
import { PrismaSalesConversionAdapter } from './sales-conversion.adapter.js';
import { SALES_AUTOMATION_PORT } from '../../common/contracts/automation-sales.port.js';
import { SALES_AGENT_WORKLOAD_PORT } from '../../common/contracts/sales-agent-workload.port.js';
import { PrismaSalesAgentWorkloadAdapter } from './sales-agent-workload.adapter.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorizationModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    PrismaSalesRepository,
    SalesAutomationAdapter,
    { provide: SALES_REPOSITORY, useExisting: PrismaSalesRepository },
    { provide: SALES_CONVERSION_PORT, useClass: PrismaSalesConversionAdapter },
    { provide: SALES_AUTOMATION_PORT, useExisting: SalesAutomationAdapter },
    {
      provide: SALES_AGENT_WORKLOAD_PORT,
      useClass: PrismaSalesAgentWorkloadAdapter,
    },
  ],
  exports: [
    SALES_CONVERSION_PORT,
    SalesService,
    SALES_REPOSITORY,
    SALES_AUTOMATION_PORT,
    SALES_AGENT_WORKLOAD_PORT,
  ],
})
export class SalesModule {}
