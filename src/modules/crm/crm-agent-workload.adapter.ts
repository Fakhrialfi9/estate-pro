import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type {
  CrmAgentWorkload,
  CrmAgentWorkloadPort,
} from '../../common/contracts/crm-agent-workload.port.js';

@Injectable()
export class PrismaCrmAgentWorkloadAdapter implements CrmAgentWorkloadPort {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkload(agentUserUuid: string): Promise<CrmAgentWorkload> {
    const [assignedLeads, closedLeads] = await Promise.all([
      this.prisma.crmLead.count({
        where: {
          ownerUserUuid: agentUserUuid,
          archivedAt: null,
          status: { isClosed: false },
        },
      }),
      this.prisma.crmLead.count({
        where: {
          ownerUserUuid: agentUserUuid,
          archivedAt: null,
          status: { isClosed: true },
        },
      }),
    ]);

    return { assignedLeads, closedLeads };
  }
}
