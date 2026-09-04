import { Module } from '@nestjs/common';
import {
  AUTOMATION_NOTIFICATION_PORT,
  AUTOMATION_SYSTEM_PORT,
  type AutomationNotificationPort,
  type AutomationSystemPort,
} from '../../common/contracts/automation-system.port.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { CrmModule } from '../crm/crm.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AutomationController } from './presentation/automation.controller.js';
import { AutomationService } from './application/services/automation.service.js';
import { WorkflowValidator } from './application/validation/workflow-validator.js';
import { PrismaAutomationRepository } from './infrastructure/persistence/prisma-automation.repository.js';
import { AUTOMATION_REPOSITORY } from './infrastructure/persistence/automation.repository.token.js';
import { AUTOMATION_ACTION_PROVIDERS } from './application/actions/automation-actions.js';
import type {
  ActionHandler,
  AutomationRepository,
} from './domain/automation.ports.js';
import { AUTOMATION_ACTION_HANDLERS } from './domain/automation.tokens.js';
import {
  CRM_AUTOMATION_PORT,
  type AutomationCrmPort,
} from '../../common/contracts/automation-crm.port.js';
import {
  SALES_AUTOMATION_PORT,
  type AutomationSalesPort,
} from '../../common/contracts/automation-sales.port.js';
import {
  USER_PUBLIC_PORT,
  type UserPublicPort,
} from '../../common/contracts/user-public.port.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../common/audit/security-audit.port.js';
import { AutomationScheduler } from './infrastructure/scheduler/automation.scheduler.js';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    UsersModule,
    CrmModule,
    SalesModule,
    AuthorizationModule,
  ],
  controllers: [AutomationController],
  providers: [
    AuthorizationGuard,
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
      ) =>
        new AutomationService(
          repo,
          crm,
          sales,
          users,
          audit,
          validator,
          handlers,
        ),
    },
    {
      provide: AUTOMATION_SYSTEM_PORT,
      inject: [AutomationService],
      useFactory: (automation: AutomationService): AutomationSystemPort => ({
        listExecutions: (input, actorUuid) =>
          automation.listExecutions(input, actorUuid),
        getExecution: (uuid, actorUuid) =>
          automation.getExecution(uuid, actorUuid),
        retryExecution: (uuid, actorUuid) =>
          automation.retryExecution(uuid, actorUuid),
        cancelExecution: (uuid, actorUuid) =>
          automation.cancelExecution(uuid, actorUuid),
      }),
    },
    {
      provide: AUTOMATION_NOTIFICATION_PORT,
      inject: [AutomationService],
      useFactory: (
        automation: AutomationService,
      ): AutomationNotificationPort => ({
        listNotifications: (input) => automation.listNotifications(input),
        markNotificationRead: (uuid, userUuid) =>
          automation.markNotificationRead(uuid, userUuid),
      }),
    },
    AutomationScheduler,
  ],
  exports: [AUTOMATION_SYSTEM_PORT, AUTOMATION_NOTIFICATION_PORT],
})
export class AutomationModule {}
