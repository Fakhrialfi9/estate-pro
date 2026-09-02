import { Injectable, Inject } from '@nestjs/common';
import {
  SALES_REPOSITORY,
  type SalesRepository,
} from '../../domain/repositories/sales.repository.js';
import type {
  AutomationOpportunityContext,
  AutomationSalesPort,
} from '../../../../common/contracts/automation-sales.port.js';

@Injectable()
export class SalesAutomationAdapter implements AutomationSalesPort {
  constructor(
    @Inject(SALES_REPOSITORY) private readonly repository: SalesRepository,
  ) {}

  async getOpportunity(uuid: string): Promise<AutomationOpportunityContext> {
    const row = await this.repository.getOpportunity(uuid);
    if (!row) throw new Error('Opportunity not found');
    return row;
  }

  async listOpenOpportunities(
    entityUuid?: string,
  ): Promise<readonly AutomationOpportunityContext[]> {
    const result = await this.repository.listOpportunities({
      ...(entityUuid ? { leadUuid: entityUuid } : {}),
      page: 1,
      limit: 100,
    });
    return result.items;
  }
}
