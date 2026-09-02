import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { CrmModule } from '../crm/crm.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { AutomationController } from './presentation/automation.controller.js';
import { AutomationService } from './application/services/automation.service.js';
import { WorkflowValidator } from './application/validation/workflow-validator.js';
import { PrismaAutomationRepository } from './infrastructure/persistence/prisma-automation.repository.js';
import { AUTOMATION_REPOSITORY } from './infrastructure/persistence/automation.repository.token.js';
import { AUTOMATION_ACTION_PROVIDERS } from './application/actions/automation-actions.js';
import type { ActionHandler, AutomationRepository } from './domain/automation.ports.js';
import { AUTOMATION_ACTION_HANDLERS } from './domain/automation.tokens.js';
import { CRM_AUTOMATION_PORT, type AutomationCrmPort } from '../../common/contracts/automation-crm.port.js';
import { SALES_AUTOMATION_PORT, type AutomationSalesPort } from '../../common/contracts/automation-sales.port.js';
import { USER_PUBLIC_PORT, type UserPublicPort } from '../../common/contracts/user-public.port.js';
import { SECURITY_AUDIT_REPOSITORY, type SecurityAuditRepository } from '../../common/audit/security-audit.port.js';

@Module({
  imports: [DatabaseModule, AuditModule, UsersModule, CrmModule, SalesModule],
  controllers: [AutomationController],
  providers: [
    WorkflowValidator,
    PrismaAutomationRepository,
    { provide: AUTOMATION_REPOSITORY, useExisting: PrismaAutomationRepository },
    ...AUTOMATION_ACTION_PROVIDERS,
    {
      provide: AUTOMATION_ACTION_HANDLERS,
      inject: [...AUTOMATION_ACTION_PROVIDERS],
      useFactory: (...handlers: ActionHandler[]) => handlers,
    },
    {
      provide: AutomationService,
      inject: [
        AUTOMATION_REPOSITORY,
        CRM_AUTOMATION_PORT,
        SALES_AUTOMATION_PORT,
        USER_PUBLIC_PORT,
        SECURITY_AUDIT_REPOSITORY,
        WorkflowValidator,
        AUTOMATION_ACTION_HANDLERS,
      ],
      useFactory: (
        repo: AutomationRepository,
        crm: AutomationCrmPort,
        sales: AutomationSalesPort,
        users: UserPublicPort,
        audit: SecurityAuditRepository,
        validator: WorkflowValidator,
        handlers: readonly ActionHandler[],
      ) => new AutomationService(repo, crm, sales, users, audit, validator, handlers),
    },
  ],
  exports: [AutomationService],
})
export class AutomationModule {}
