import { describe, expect, it, vi } from 'vitest';

import { SalesAutomationAdapter } from '../../../src/modules/sales/application/services/sales-automation.adapter.js';

describe('SalesAutomationAdapter', () => {
  it('returns an opportunity from the sales repository', async () => {
    const opportunity = {
      uuid: '11111111-1111-4111-8111-111111111111',
      ownerUserUuid: '22222222-2222-4222-8222-222222222222',
      status: 'OPEN',
    };
    const repository = {
      getOpportunity: vi.fn().mockResolvedValue(opportunity),
      listOpportunities: vi.fn(),
    };
    const adapter = new SalesAutomationAdapter(repository as never);

    await expect(adapter.getOpportunity(opportunity.uuid)).resolves.toEqual(
      opportunity,
    );
    expect(repository.getOpportunity).toHaveBeenCalledWith(opportunity.uuid);
  });

  it('fails closed when the opportunity does not exist', async () => {
    const repository = {
      getOpportunity: vi.fn().mockResolvedValue(null),
      listOpportunities: vi.fn(),
    };
    const adapter = new SalesAutomationAdapter(repository as never);

    await expect(adapter.getOpportunity('missing')).rejects.toThrow(
      'Opportunity not found',
    );
  });

  it('lists open opportunities with optional lead filtering', async () => {
    const repository = {
      getOpportunity: vi.fn(),
      listOpportunities: vi.fn().mockResolvedValue({
        items: [{ uuid: 'opportunity-1' }],
        total: 1,
        page: 1,
        limit: 100,
      }),
    };
    const adapter = new SalesAutomationAdapter(repository as never);

    await expect(adapter.listOpenOpportunities()).resolves.toEqual([
      { uuid: 'opportunity-1' },
    ]);
    expect(repository.listOpportunities).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
    });

    await adapter.listOpenOpportunities('lead-1');
    expect(repository.listOpportunities).toHaveBeenLastCalledWith({
      leadUuid: 'lead-1',
      page: 1,
      limit: 100,
    });
  });
});
