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
import type { ActionHandler } from './domain/automation.ports.js';

const AUTOMATION_ACTION_HANDLERS = Symbol('AUTOMATION_ACTION_HANDLERS');

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
      inject: [AUTOMATION_ACTION_HANDLERS],
      useFactory: (handlers: readonly ActionHandler[], repo: AutomationService) => repo,
    },
  ],
  exports: [AutomationService],
})
export class AutomationModule {}
