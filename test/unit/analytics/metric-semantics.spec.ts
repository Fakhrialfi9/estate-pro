import { describe, expect, it } from 'vitest';
import { AnalyticsService } from '../../../src/modules/analytics/application/analytics.service.js';
import { AnalyticsScopePolicy } from '../../../src/modules/analytics/domain/policies/analytics-scope.policy.js';

const user = (
  permissions: string[] = ['analytics.read'],
): { sub: string; permissions: string[] } => ({
  sub: '00000000-0000-0000-0000-000000000001',
  permissions,
});

const repo = {
  leadVolume: async () => [],
  leadLifecycle: async () => [],
  leadAging: async () => [],
  leadFunnel: async () => [
    { status: 'NEW', count: 2 },
    { status: 'QUALIFIED', count: 1 },
  ],
  leadAssignment: async () => [],
  sourcePerformance: async () => [{ leads: 4, qualified: 2, converted: 1 }],
  campaignPerformance: async () => [],
  conversion: async () => [
    {
      leads: 10,
      opportunities: 4,
      wonDeals: 2,
      leadToOpportunityDays: 3,
      opportunityToCloseDays: 8,
    },
  ],
  cohort: async () => [],
  pipeline: async () => [],
  stageVelocity: async () => [],
  opportunityAging: async () => [],
  opportunityValue: async () => [],
  propertyInventory: async () => [],
  listingAnalytics: async () => [],
  propertyLifecycle: async () => [],
  propertyAging: async () => [],
  agentWorkload: async () => [],
  agentActivity: async () => [],
  agentConversion: async () => [],
  agentProperty: async () => [],
  salesVolume: async () => [],
  salesCycle: async () => [],
  revenue: async () => [],
  averageDeal: async () => [],
  sla: async () => [],
  forecastInput: async () => [
    {
      closedRevenue: 500,
      closedDeals: 5,
      weightedPipeline: 1500,
      openOpportunities: 3,
    },
  ],
} as never;

describe('analytics domain semantics', () => {
  it('rejects reversed ranges', () => {
    const service = new AnalyticsService(repo, new AnalyticsScopePolicy());
    expect(() =>
      service.normalizeQuery({
        from: '2026-01-02T00:00:00Z',
        to: '2026-01-01T00:00:00Z',
        page: 1,
        limit: 50,
      } as never),
    ).toThrow('`from` must be earlier than `to`.');
  });

  it('rejects ranges larger than one year', () => {
    const service = new AnalyticsService(repo, new AnalyticsScopePolicy());
    expect(() =>
      service.normalizeQuery({
        from: '2025-01-01T00:00:00Z',
        to: '2026-09-01T00:00:00Z',
        page: 1,
        limit: 50,
      } as never),
    ).toThrow('cannot exceed 366 days');
  });

  it('uses explicit funnel denominator', async () => {
    const service = new AnalyticsService(repo, new AnalyticsScopePolicy());
    const result = await service.leads({ page: 1, limit: 50 } as never, user());
    const funnel = (
      result.data[0] as {
        funnel: readonly { status: string; percentage: number }[];
      }
    ).funnel;
    expect(
      funnel.find((item) => item.status === 'NEW')?.percentage,
    ).toBeCloseTo(66.6667, 3);
    expect(
      funnel.find((item) => item.status === 'QUALIFIED')?.percentage,
    ).toBeCloseTo(33.3333, 3);
  });

  it('marks forecast confidence insufficient below minimum sample', async () => {
    const forecastRepo = {
      ...repo,
      forecastInput: async () => [
        {
          closedRevenue: 100,
          closedDeals: 2,
          weightedPipeline: 1000,
          openOpportunities: 3,
        },
      ],
    } as never;
    const service = new AnalyticsService(
      forecastRepo,
      new AnalyticsScopePolicy(),
    );
    const result = await service.forecast(
      { page: 1, limit: 50 } as never,
      user(['analytics.forecast']),
    );
    expect((result.data[0] as { confidence: string }).confidence).toBe(
      'INSUFFICIENT_DATA',
    );
  });
});
