import { Module } from '@nestjs/common';
import {
  AUTOMATION_NOTIFICATION_PORT,
  AUTOMATION_SYSTEM_PORT,
  type AutomationNotificationPort,
  type AutomationSystemPort,
} from '../../common/contracts/automation-system.port.js';
import { AUTOMATION_HEALTH_PORT, type AutomationHealthPort } from '../../common/contracts/automation-health.port.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { CrmModule } from '../crm/crm.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { AutomationController } from './presentation/automation.controller.js';
import { AutomationService } from './application/services/automation.service.js';
import { AutomationNotificationService } from './application/services/automation-notification.service.js';
import { WorkflowValidator } from './application/validation/workflow-validator.js';
import { PrismaAutomationRepository } from './infrastructure/persistence/prisma-automation.repository.js';
import { PrismaAutomationNotificationRepository } from './infrastructure/persistence/prisma-automation-notification.repository.js';
import { AUTOMATION_REPOSITORY } from './infrastructure/persistence/automation.repository.token.js';
import { AUTOMATION_NOTIFICATION_REPOSITORY } from './domain/repositories/automation-notification.repository.js';
import { AUTOMATION_ACTION_PROVIDERS } from './application/actions/automation-actions.js';
import type { ActionHandler, AutomationRepository } from './domain/automation.ports.js';
import { AUTOMATION_ACTION_HANDLERS } from './domain/automation.tokens.js';
import { CRM_AUTOMATION_PORT, type AutomationCrmPort } from '../../common/contracts/automation-crm.port.js';
import { SALES_AUTOMATION_PORT, type AutomationSalesPort } from '../../common/contracts/automation-sales.port.js';
import { USER_PUBLIC_PORT, type UserPublicPort } from '../../common/contracts/user-public.port.js';
import { SECURITY_AUDIT_REPOSITORY, type SecurityAuditRepository } from '../../common/audit/security-audit.port.js';
import { AutomationScheduler } from './infrastructure/scheduler/automation.scheduler.js';

@Module({
  imports: [DatabaseModule, AuditModule, UsersModule, CrmModule, SalesModule, AuthorizationModule],
  controllers: [AutomationController],
  providers: [
    AuthorizationGuard,
    WorkflowValidator,
    PrismaAutomationRepository,
    PrismaAutomationNotificationRepository,
    AutomationNotificationService,
    { provide: AUTOMATION_REPOSITORY, useExisting: PrismaAutomationRepository },
    { provide: AUTOMATION_NOTIFICATION_REPOSITORY, useExisting: PrismaAutomationNotificationRepository },
    ...AUTOMATION_ACTION_PROVIDERS,
    { provide: AUTOMATION_ACTION_HANDLERS, inject: [...AUTOMATION_ACTION_PROVIDERS], useFactory: (...handlers: ActionHandler[]) => handlers },
    {
      provide: AutomationService,
      inject: [AUTOMATION_REPOSITORY, CRM_AUTOMATION_PORT, SALES_AUTOMATION_PORT, USER_PUBLIC_PORT, SECURITY_AUDIT_REPOSITORY, WorkflowValidator, AUTOMATION_ACTION_HANDLERS],
      useFactory: (repo: AutomationRepository, crm: AutomationCrmPort, sales: AutomationSalesPort, users: UserPublicPort, audit: SecurityAuditRepository, validator: WorkflowValidator, handlers: readonly ActionHandler[]) => new AutomationService(repo, crm, sales, users, audit, validator, handlers),
    },
    {
      provide: AUTOMATION_SYSTEM_PORT,
      inject: [AutomationService],
      useFactory: (automation: AutomationService): AutomationSystemPort => ({
        listExecutions: (input, actorUuid) => automation.listExecutions(input, actorUuid),
        getExecution: (uuid, actorUuid) => automation.getExecution(uuid, actorUuid),
        retryExecution: (uuid, actorUuid) => automation.retryExecution(uuid, actorUuid),
        cancelExecution: (uuid, actorUuid) => automation.cancelExecution(uuid, actorUuid),
      }),
    },
    {
      provide: AUTOMATION_NOTIFICATION_PORT,
      inject: [AutomationService, AutomationNotificationService],
      useFactory: (automation: AutomationService, notifications: AutomationNotificationService): AutomationNotificationPort => ({
        createNotification: (input) => notifications.createNotification(input),
        listNotifications: (input) => automation.listNotifications(input),
        markNotificationRead: (uuid, userUuid) => automation.markNotificationRead(uuid, userUuid),
        markAllNotificationsRead: async (userUuid) => {
          let updated = 0;
          for (let iteration = 0; iteration < 100; iteration += 1) {
            const result = (await automation.listNotifications({ userUuid, page: 1, limit: 100, unreadOnly: true })) as { items?: readonly Record<string, unknown>[] };
            const items = result.items ?? [];
            if (items.length === 0) break;
            for (const item of items) {
              const uuid = typeof item.uuid === 'string' ? item.uuid : undefined;
              if (!uuid) continue;
              if (await automation.markNotificationRead(uuid, userUuid)) updated += 1;
            }
            if (items.length < 100) break;
          }
          return { updated };
        },
        listPreferences: (userUuid) => notifications.listPreferences(userUuid),
        setPreference: (input) => notifications.setPreference(input.userUuid, { notificationType: input.notificationType, channel: input.channel, enabled: input.enabled }),
        listTemplates: (input) => notifications.listTemplates(input),
        createTemplate: (input) => notifications.createTemplate(input),
        updateTemplate: (input) => notifications.updateTemplate(input.uuid, input),
        setPolicy: (input) => notifications.setPolicy(input.notificationUuid, input),
        getPolicy: (notificationUuid) => notifications.getPolicy(notificationUuid),
        createDelivery: (input) => notifications.createDelivery(input.notificationUuid, input.channel, input.maxAttempts),
        listDeliveries: (notificationUuid) => notifications.listDeliveries(notificationUuid),
      }),
    },
    AutomationScheduler,
    { provide: AUTOMATION_HEALTH_PORT, inject: [AutomationScheduler], useFactory: (scheduler: AutomationScheduler): AutomationHealthPort => ({ check: () => Promise.resolve(scheduler.isHealthy() ? 'up' : 'down') }) },
  ],
  exports: [AUTOMATION_SYSTEM_PORT, AUTOMATION_NOTIFICATION_PORT, AUTOMATION_HEALTH_PORT],
})
export class AutomationModule {}
