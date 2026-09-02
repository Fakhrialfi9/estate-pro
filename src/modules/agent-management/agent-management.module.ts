import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { UsersModule } from '../users/users.module.js';
import { PropertyModule } from '../property/property.module.js';
import { CrmModule } from '../crm/crm.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { AGENT_CANDIDATE_PORT } from '../../common/contracts/agent-candidate.port.js';
import { AgentManagementController } from './presentation/agent-management.controller.js';
import { AgentManagementService } from './application/agent-management.service.js';
import { PrismaAgentRepository } from './infrastructure/persistence/prisma-agent.repository.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorizationModule, UsersModule, PropertyModule, CrmModule, SalesModule],
  controllers: [AgentManagementController],
  providers: [
    PrismaAgentRepository,
    AgentManagementService,
    { provide: AGENT_CANDIDATE_PORT, useExisting: AgentManagementService },
  ],
  exports: [AgentManagementService, AGENT_CANDIDATE_PORT],
})
export class AgentManagementModule {}
