import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import {
  AUTOMATION_HEALTH_PORT,
  type AutomationHealthPort,
} from '../../common/contracts/automation-health.port.js';
import {
  AUTOMATION_NOTIFICATION_PORT,
  type AutomationNotificationPort,
  AUTOMATION_SYSTEM_PORT,
  type AutomationSystemPort,
} from '../../common/contracts/automation-system.port.js';
import { AutomationService } from './application/services/automation.service.js';
import { AutomationScheduler } from './infrastructure/scheduler/automation.scheduler.js';
import { PrismaAutomationRepository } from './infrastructure/persistence/prisma-automation.repository.js';

@Module({
  providers: [
    PrismaService,
    AutomationService,
    PrismaAutomationRepository,
    {
      provide: AUTOMATION_SYSTEM_PORT,
      inject: [AutomationService],
      useFactory: (service: AutomationService): AutomationSystemPort => ({
        createRule: (input) => service.createRule(input),
        updateRule: (uuid, input) => service.updateRule(uuid, input),
        deleteRule: (uuid) => service.deleteRule(uuid),
        listRules: (input) => service.listRules(input),
        executeRule: (uuid, input) => service.executeRule(uuid, input),
      }),
    },
    {
      provide: AUTOMATION_NOTIFICATION_PORT,
      inject: [AutomationService],
      useFactory: (
        service: AutomationService,
      ): AutomationNotificationPort => ({
        listNotifications: (input) => service.listNotifications(input),
        markNotificationRead: (uuid, userUuid) =>
          service.markNotificationRead(uuid, userUuid),
        markAllNotificationsRead: (userUuid) =>
          service.markAllNotificationsRead(userUuid),
      }),
    },
    AutomationScheduler,
    {
      provide: AUTOMATION_HEALTH_PORT,
      inject: [AutomationScheduler],
      useFactory: (scheduler: AutomationScheduler): AutomationHealthPort => ({
        check() {
          return Promise.resolve(scheduler.isHealthy() ? 'up' : 'down');
        },
      }),
    },
  ],
  exports: [
    AUTOMATION_SYSTEM_PORT,
    AUTOMATION_NOTIFICATION_PORT,
    AUTOMATION_HEALTH_PORT,
  ],
})
export class AutomationModule {}
