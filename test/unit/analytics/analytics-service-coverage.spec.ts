import { AnalyticsService } from '../../../src/modules/analytics/application/analytics.service.js';
import {
  AnalyticsInvalidQueryException,
  AnalyticsQueryTimeoutException,
  AnalyticsScopeException,
  AnalyticsUnavailableException,
} from '../../../src/modules/analytics/domain/errors/analytics.errors.js';
import type { AnalyticsQueryPort } from '../../../src/modules/analytics/domain/analytics.types.js';
import type { AccessTokenClaims } from '../../../src/common/security/access-token-verifier.port.js';
import { describe, expect, it, vi } from 'vitest';

const user = (permissions: string[] = []): AccessTokenClaims =>
  ({ sub: 'user-1', sid: 'session-1', permissions }) as AccessTokenClaims;

type LeadReport = {
  funnel: Array<{ percentage: number }>;
  volume: unknown[];
  lifecycle: Record<string, unknown>;
  aging: Record<string, unknown>;
  assignments: unknown[];
};
type AcquisitionReport = {
  sources: Array<{ conversionRate: number }>;
  campaigns: unknown[];
};
type ConversionReport = {
  leadToOpportunity: { rate: number };
};
type PipelineReport = { pipeline: unknown[] };
type PropertyReport = { inventory: Array<{ active: number }> };
type AgentReport = {
  conversion: Array<Record<string, unknown>>;
  activity: Array<{ category: string }>;
};
type CombinedReport = {
  conversion: Array<Record<string, unknown>>;
  scorecards: Array<{ conversionRate: number }>;
};
type SlaReport = { responseSla: { thresholdHours: number } };
type ForecastReport = { forecast: number; confidence: string };

const rows = (method: string): Record<string, unknown>[] => {
  switch (method) {
    case 'leadVolume':
      return [
        {
          count: 10n,
          date: new Date('2026-01-01T00:00:00.000Z'),
        },
      ];
    case 'leadLifecycle':
      return [{ new: 3, converted: 1 }];
    case 'leadAging':
      return [{ averageDays: '2.5' }];
    case 'leadFunnel':
      return [
        { stage: 'NEW', count: 2 },
        { stage: 'QUALIFIED', count: 3 },
      ];
    case 'leadAssignment':
      return [{ agentUuid: 'agent-1', count: 5 }];
    case 'sourcePerformance':
      return [
        {
          leads: 10,
          qualified: 5,
          converted: 2,
          source: 'web,paid',
        },
      ];
    case 'campaignPerformance':
      return [{ leads: 10, qualified: 5, converted: 2, source: 'web' }];
    case 'conversion':
      return [
        {
          leads: 10,
          opportunities: 4,
          wonDeals: 2,
          leadToOpportunityDays: 3,
          opportunityToCloseDays: 7,
        },
      ];
    case 'cohort':
      return [{ leads: 4, converted: 1, cohort: '2026-01' }];
    case 'pipeline':
    case 'stageVelocity':
    case 'opportunityAging':
    case 'opportunityValue':
      return [{ stage: 'QUALIFIED', value: '123.45' }];
    case 'propertyInventory':
    case 'listingAnalytics':
    case 'propertyLifecycle':
    case 'propertyAging':
      return [{ active: 5, averageDays: 9 }];
    case 'agentWorkload':
      return [{ agentUuid: 'agent-1', active: 4 }];
    case 'agentActivity':
      return [
        { agentUuid: 'agent-1', type: 'CALL_MADE' },
        { agentUuid: 'agent-1', type: 'WHATSAPP_MESSAGE' },
        { agentUuid: 'agent-1', type: 'SHOWING' },
        { agentUuid: 'agent-1', type: 'NOTE_ADDED' },
        { agentUuid: 'agent-1', type: 'SYSTEM_EVENT' },
      ];
    case 'agentConversion':
      return [
        {
          agentUuid: 'agent-1',
          opportunities: 4,
          wonDeals: 2,
          revenue: '1000',
        },
      ];
    case 'agentProperty':
      return [
        {
          agentUuid: 'agent-1',
          activeProperties: 3,
          publishedProperties: 2,
        },
      ];
    case 'salesVolume':
    case 'salesCycle':
    case 'revenue':
    case 'averageDeal':
      return [{ deals: 4, value: 100 }];
    case 'sla':
      return [{ averageResponseHours: 2, averageQualificationHours: 20 }];
    case 'forecastInput':
      return [{ closedRevenue: 1000, closedDeals: 10, weightedPipeline: 500 }];
    default:
      return [];
  }
};

const makeQueries = (): AnalyticsQueryPort =>
  new Proxy(
    {},
    {
      get: (_target, property) => vi.fn(() => rows(String(property))),
    },
  ) as AnalyticsQueryPort;

const makePolicy = (revenue = true, forecast = true, exportAllowed = true) => ({
  resolve: vi.fn(() => ({ kind: 'GLOBAL' })),
  canReadRevenue: vi.fn(() => revenue),
  canForecast: vi.fn(() => forecast),
  canExport: vi.fn(() => exportAllowed),
});

describe('AnalyticsService coverage', () => {
  it('normalizes query defaults, bounds, optional filters, and rejects invalid ranges', () => {
    const service = new AnalyticsService(makeQueries(), makePolicy() as never);
    const query = service.normalizeQuery({
      to: '2026-01-31T00:00:00.000Z',
      granularity: 'week',
      page: 999,
      limit: 999,
      ownerUserUuid: 'owner',
      sourceUuid: 'source',
      campaignUuid: 'campaign',
      pipelineUuid: 'pipeline',
      stageUuid: 'stage',
      propertyUuid: 'property',
      currency: 'IDR',
    });
    expect(query.page).toBe(50);
    expect(query.limit).toBe(100);
    expect(query.granularity).toBe('week');
    expect(query.currency).toBe('IDR');
    expect(() =>
      service.normalizeQuery({ from: 'invalid', to: 'invalid' }),
    ).toThrow(AnalyticsInvalidQueryException);
    expect(() =>
      service.normalizeQuery({ from: '2024-01-01', to: '2026-01-01' }),
    ).toThrow('cannot exceed');
  });

  it('builds lead, acquisition, conversion, pipeline, and property reports', async () => {
    const service = new AnalyticsService(makeQueries(), makePolicy() as never);
    const dto = {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-03T00:00:00.000Z',
      page: 1,
      limit: 10,
    };
    const lead = (await service.leads(dto, user())).data[0] as LeadReport;
    const acquisition = (await service.acquisition(dto, user()))
      .data[0] as AcquisitionReport;
    const conversion = (await service.conversion(dto, user()))
      .data[0] as ConversionReport;
    const pipeline = (await service.pipeline(dto, user()))
      .data[0] as PipelineReport;
    const property = (await service.property(dto, user()))
      .data[0] as PropertyReport;
    expect(lead.funnel[0]?.percentage).toBe(40);
    expect(acquisition.sources[0]?.conversionRate).toBe(20);
    expect(conversion.leadToOpportunity.rate).toBe(40);
    expect(pipeline.pipeline).toHaveLength(1);
    expect(property.inventory[0]?.active).toBe(5);
  });

  it('builds agent and combined reports with and without revenue visibility', async () => {
    const dto = {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-03T00:00:00.000Z',
    };
    const restricted = new AnalyticsService(
      makeQueries(),
      makePolicy(false, true, true) as never,
    );
    const restrictedReport = (await restricted.agent(dto, user()))
      .data[0] as AgentReport;
    expect(restrictedReport.conversion[0]).not.toHaveProperty('revenue');
    expect(restrictedReport.activity.map((x) => x.category)).toEqual([
      'CALL',
      'MESSAGE',
      'VIEWING',
      'NOTE',
      'OTHER',
    ]);

    const full = new AnalyticsService(
      makeQueries(),
      makePolicy(true, true, true) as never,
    );
    const fullReport = (await full.propertyAndAgent(dto, user()))
      .data[0] as CombinedReport;
    expect(fullReport.conversion[0]?.revenue).toBe('1000');
    expect(fullReport.scorecards[0]?.conversionRate).toBe(50);
  });

  it('enforces revenue and forecast permissions and calculates forecast', async () => {
    const dto = {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-03T00:00:00.000Z',
    };
    const deniedRevenue = new AnalyticsService(
      makeQueries(),
      makePolicy(false, true, true) as never,
    );
    await expect(deniedRevenue.salesAndRevenue(dto, user())).rejects.toThrow(
      AnalyticsScopeException,
    );
    const deniedForecast = new AnalyticsService(
      makeQueries(),
      makePolicy(true, false, true) as never,
    );
    await expect(deniedForecast.forecast(dto, user())).rejects.toThrow(
      AnalyticsScopeException,
    );

    const service = new AnalyticsService(
      makeQueries(),
      makePolicy(true, true, true) as never,
    );
    const sla = (await service.sla(dto, user())).data[0] as SlaReport;
    const forecast = (await service.forecast(dto, user()))
      .data[0] as ForecastReport;
    expect(sla.responseSla.thresholdHours).toBe(24);
    expect(forecast.forecast).toBe(600);
    expect(forecast.confidence).toBe('NORMAL');
  });

  it('exports supported reports to CSV, including escaping and empty results', async () => {
    const dto = {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-03T00:00:00.000Z',
    };
    const service = new AnalyticsService(
      makeQueries(),
      makePolicy(true, true, true) as never,
    );
    const csv = await service.exportCsv(dto, user(), 'leads');
    expect(csv.filename).toBe('analytics-leads.csv');
    expect(csv.content).toContain('volume');

    const acquisition = await service.exportCsv(dto, user(), 'acquisition');
    expect(acquisition.content).toContain('"web,paid"');
    await expect(service.exportCsv(dto, user(), 'unknown')).rejects.toThrow(
      AnalyticsInvalidQueryException,
    );

    const noRows = new Proxy(makeQueries(), {
      get: () => vi.fn(() => []),
    });
    const emptyService = new AnalyticsService(
      noRows,
      makePolicy(true, true, true) as never,
    );
    const empty = await emptyService.exportCsv(dto, user(), 'pipeline');
    expect(empty.content).toBe('');
    await expect(
      new AnalyticsService(
        makeQueries(),
        makePolicy(true, true, false) as never,
      ).exportCsv(dto, user(), 'leads'),
    ).rejects.toThrow(AnalyticsScopeException);
  });

  it('normalizes unexpected query failures and timeout conditions', async () => {
    const failing = new Proxy(
      {},
      {
        get: () =>
          vi.fn(() => {
            throw new Error('failure');
          }),
      },
    ) as AnalyticsQueryPort;
    const failingService = new AnalyticsService(failing, makePolicy() as never);
    await expect(
      failingService.leads({ from: '2026-01-01', to: '2026-01-03' }, user()),
    ).rejects.toThrow(AnalyticsUnavailableException);

    vi.useFakeTimers();
    const pending = new Proxy(
      {},
      {
        get: () => vi.fn(() => new Promise(() => undefined)),
      },
    ) as AnalyticsQueryPort;
    const pendingService = new AnalyticsService(pending, makePolicy() as never);
    const promise = pendingService.leads(
      { from: '2026-01-01', to: '2026-01-03' },
      user(),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).rejects.toThrow(AnalyticsQueryTimeoutException);
    vi.useRealTimers();
  });
});
