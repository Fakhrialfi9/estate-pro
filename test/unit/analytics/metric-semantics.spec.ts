import { describe, expect, it } from 'vitest';
import { AnalyticsScopePolicy } from '../../../src/modules/analytics/domain/policies/analytics-scope.policy.js';
import { AnalyticsService } from '../../../src/modules/analytics/application/analytics.service.js';
import type { AnalyticsQueryPort } from '../../../src/modules/analytics/domain/analytics.types.js';
import type { AccessTokenClaims } from '../../../src/common/security/access-token-verifier.port.js';

const user = (
  permissions: string[] = ['analytics.read', 'analytics.forecast'],
): AccessTokenClaims => ({
  sub: '11111111-1111-4111-8111-111111111111',
  sid: '22222222-2222-4222-8222-222222222222',
  jti: '33333333-3333-4333-8333-333333333333',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
  permissions,
});

const repo: AnalyticsQueryPort = {
  async leads() {
    return [
      {
        total: 3,
        items: [
          { status: 'NEW', count: 2, percentage: 66.6666666667 },
          { status: 'QUALIFIED', count: 1, percentage: 33.3333333333 },
        ],
      },
    ];
  },
  async pipeline() {
    return [
      {
        totalValue: 1000,
        weightedValue: 500,
        currency: 'IDR',
        stages: [],
      },
    ];
  },
  async sales() {
    return [
      {
        totalRevenue: 1000,
        totalDeals: 2,
        currency: 'IDR',
        series: [],
      },
    ];
  },
  async forecastInput() {
    return [
      {
        closedRevenue: 100,
        closedDeals: 5,
        weightedPipeline: 500,
        openOpportunities: 4,
      },
    ];
  },
};

describe('AnalyticsService metric semantics', () => {
  it('rejects a reporting range over 366 days', () => {
    const service = new AnalyticsService(repo, new AnalyticsScopePolicy());
    expect(() =>
      service.normalizeQuery({
        from: '2024-01-01T00:00:00.000Z',
        to: '2025-01-03T00:00:00.000Z',
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
      forecastInput: () =>
        Promise.resolve([
          {
            closedRevenue: 100,
            closedDeals: 2,
            weightedPipeline: 1000,
            openOpportunities: 3,
          },
        ]),
    } satisfies AnalyticsQueryPort;
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
