import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type {
  SalesAgentWorkload,
  SalesAgentWorkloadPort,
} from '../../common/contracts/sales-agent-workload.port.js';

@Injectable()
export class PrismaSalesAgentWorkloadAdapter implements SalesAgentWorkloadPort {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkload(agentUserUuid: string): Promise<SalesAgentWorkload> {
    const [openOpportunities, openDeals, amounts] = await Promise.all([
      this.prisma.salesOpportunity.count({
        where: { ownerUserUuid: agentUserUuid, status: 'OPEN' },
      }),
      this.prisma.salesDeal.count({
        where: { ownerUserUuid: agentUserUuid, status: 'OPEN' },
      }),
      this.prisma.salesDeal.aggregate({
        where: { ownerUserUuid: agentUserUuid },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      openOpportunities,
      openDeals,
      salesValue: amounts._sum.totalAmount?.toString() ?? '0',
    };
  }
}
