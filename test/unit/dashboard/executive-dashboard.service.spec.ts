import { describe, expect, it, vi } from 'vitest';
import { ExecutiveDashboardService } from '../../../src/modules/dashboard/executive-dashboard.service.js';

const AGENT_UUID = '00000000-0000-0000-0000-000000000001';

const user = (permissions: string[] = ['analytics.read']) => ({
  sub: AGENT_UUID,
  permissions,
});

const query = {
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-01-31T00:00:00.000Z',
  granularity: 'day' as const,
  page: 1,
  limit: 50,
};

const meta = {
  generatedAt: '2026-02-01T00:00:00.000Z',
  from: query.from,
  to: query.to,
  timezone: 'UTC' as const,
  granularity: 'day' as const,
  page: 1,
  limit: 50,
  total: 1,
};

const report = (data: Record<string, unknown>) => ({
  data: [data],
  meta,
});

describe('ExecutiveDashboardService', () => {
  function setup(analyticsOverrides: Record<string, unknown> = {}) {
    const analytics = {
      property: vi.fn().mockResolvedValue(
        report({
          inventory: [
            {
              status: 'ACTIVE',
              propertyType: 'HOUSE',
              propertyCategory: 'RESIDENTIAL',
              count: 2,
            },
          ],
          listings: [],
          lifecycle: {
            created: 2,
            published: 1,
            verified: 1,
            deleted: 0,
            archived: 0,
          },
          aging: {
            averagePublishDays: 1,
            averageVerifyDays: 2,
            averageInactiveAgeDays: 3,
          },
        }),
      ),
      leads: vi.fn().mockResolvedValue(
        report({
          volume: [],
          lifecycle: {},
          aging: {},
          funnel: [],
          assignments: [],
        }),
      ),
      acquisition: vi
        .fn()
        .mockResolvedValue(report({ sources: [], campaigns: [] })),
      conversion: vi.fn().mockResolvedValue(
        report({
          leadToOpportunity: { leads: 1, opportunities: 1, rate: 100 },
          opportunityToDeal: { opportunities: 1, wonDeals: 1, rate: 100 },
          cycleTime: { leadToOpportunityDays: 1, opportunityToCloseDays: 2 },
        }),
      ),
      sla: vi.fn().mockResolvedValue(
        report({
          leads: 1,
          qualificationCompliant: 1,
          qualificationBreached: 0,
          averageResponseHours: 1,
          averageQualificationHours: 2,
          qualificationThresholdHours: 48,
          responseSla: { averageHours: 1, thresholdHours: 24 },
          qualificationSla: { averageHours: 2, thresholdHours: 48 },
        }),
      ),
      pipeline: vi
        .fn()
        .mockResolvedValue(
          report({ pipeline: [], stageVelocity: [], aging: [], value: [] }),
        ),
      salesAndRevenue: vi.fn().mockResolvedValue(
        report({
          sales: [],
          cycle: {},
          revenue: [
            {
              period: query.from,
              currency: 'USD',
              closedRevenue: '100.00',
              deals: 1,
            },
          ],
          averageDeal: [
            {
              currency: 'USD',
              deals: 1,
              averageValue: '100.00',
              minValue: '100.00',
              maxValue: '100.00',
            },
          ],
        }),
      ),
      forecast: vi.fn().mockResolvedValue(
        report({
          target: 'expected-revenue',
          forecast: 100,
          methodology: 'weighted-open-pipeline-plus-historical-average-deal',
          confidence: 'NORMAL',
          minimumHistoricalDeals: 5,
          historicalAverageDeal: 50,
          weightedPipeline: 50,
        }),
      ),
      agent: vi.fn().mockResolvedValue(
        report({
          workload: [
            {
              agentUuid: AGENT_UUID,
              displayName: 'Agent',
              leads: 1,
              opportunities: 2,
              properties: 3,
              activities: 4,
            },
          ],
          activity: [],
          conversion: [
            {
              agentUuid: AGENT_UUID,
              opportunities: 2,
              wonDeals: 1,
              revenue: '100.00',
            },
          ],
          propertiesByAgent: [],
          scorecards: [
            {
              agentUuid: AGENT_UUID,
              displayName: 'Agent',
              leads: 1,
              opportunities: 2,
              properties: 3,
              activities: 4,
              activeProperties: 1,
              publishedProperties: 1,
              wonDeals: 1,
              conversionRate: 50,
              revenue: '100.00',
            },
          ],
        }),
      ),
      ...analyticsOverrides,
    } as never;

    const operations = {
      diagnostics: vi.fn().mockResolvedValue({
        status: 'ok',
        maintenanceMode: false,
        readOnlyMode: false,
        components: { database: 'up', storage: 'up', jobs: 'up' },
      }),
    } as never;

    return {
      service: new ExecutiveDashboardService(analytics, operations),
      analytics,
    };
  }

  it('queries only property analytics for property dashboard', async () => {
    const { service, analytics } = setup();

    const result = await service.getProperty(query, user());

    expect(result.data.inventory).toHaveLength(1);
    expect(analytics.property).toHaveBeenCalledOnce();
    expect(analytics.leads).not.toHaveBeenCalled();
    expect(analytics.pipeline).not.toHaveBeenCalled();
    expect(analytics.agent).not.toHaveBeenCalled();
  });

  it('excludes agent revenue without revenue permission', async () => {
    const { service } = setup();

    const result = await service.getAgent(query, user(['analytics.read']));

    expect(result.data.conversion[0]).not.toHaveProperty('revenue');
    expect(result.data.scorecards[0]).not.toHaveProperty('revenue');
  });

  it('includes agent revenue with revenue permission', async () => {
    const { service } = setup();

    const result = await service.getAgent(
      query,
      user(['analytics.read', 'analytics.revenue.read']),
    );

    expect(result.data.conversion[0]).toHaveProperty('revenue', '100.00');
    expect(result.data.scorecards[0]).toHaveProperty('revenue', '100.00');
  });

  it('does not query financial analytics without revenue permission', async () => {
    const { service, analytics } = setup();

    await service.getSales(query, user(['analytics.read']));

    expect(analytics.salesAndRevenue).not.toHaveBeenCalled();
    expect(analytics.forecast).not.toHaveBeenCalled();
  });

  it('queries financial and forecast analytics only when permitted', async () => {
    const { service, analytics } = setup();

    await service.getSales(
      query,
      user(['analytics.read', 'analytics.revenue.read', 'analytics.forecast']),
    );

    expect(analytics.salesAndRevenue).toHaveBeenCalledOnce();
    expect(analytics.forecast).toHaveBeenCalledOnce();
  });
});
