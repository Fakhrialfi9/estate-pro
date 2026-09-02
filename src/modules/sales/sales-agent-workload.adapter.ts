import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type { SalesAgentWorkload, SalesAgentWorkloadPort } from '../../common/contracts/sales-agent-workload.port.js';

@Injectable()
export class PrismaSalesAgentWorkloadAdapter implements SalesAgentWorkloadPort {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkload(agentUserUuid: string): Promise<SalesAgentWorkload> {
    const db = this.prisma as any;
    const [openOpportunities, openDeals, amounts] = await Promise.all([
      db.salesOpportunity.count({ where: { ownerUserUuid: agentUserUuid, status: 'OPEN' } }),
      db.salesDeal.count({ where: { ownerUserUuid: agentUserUuid, status: 'OPEN' } }),
      db.salesDeal.aggregate({ where: { ownerUserUuid: agentUserUuid }, _sum: { totalAmount: true } }),
    ]);
    return { openOpportunities, openDeals, salesValue: Number(amounts._sum.totalAmount ?? 0) };
  }
}
