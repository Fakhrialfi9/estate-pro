export const ANALYTICS_GRANULARITIES = ['day', 'week', 'month'] as const;
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

export type AnalyticsScope =
  | { kind: 'global'; userUuid: string }
  | { kind: 'agent'; userUuid: string };

export interface AnalyticsQuery {
  from: Date;
  to: Date;
  granularity: AnalyticsGranularity;
  page: number;
  limit: number;
  ownerUserUuid?: string;
  sourceUuid?: string;
  campaignUuid?: string;
  pipelineUuid?: string;
  stageUuid?: string;
  propertyUuid?: string;
  currency?: string;
}

export interface ReportMetadata {
  generatedAt: string;
  from: string;
  to: string;
  timezone: 'UTC';
  granularity: AnalyticsGranularity;
  page: number;
  limit: number;
  total: number;
}

export interface AnalyticsReport<T> {
  data: readonly T[];
  meta: ReportMetadata;
}

export interface AnalyticsQueryPort {
  leadVolume(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  leadLifecycle(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  leadAging(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  leadFunnel(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  leadAssignment(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  sourcePerformance(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  campaignPerformance(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  conversion(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  cohort(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  pipeline(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  stageVelocity(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  opportunityAging(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  opportunityValue(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  propertyInventory(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  listingAnalytics(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  propertyLifecycle(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  propertyAging(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  agentWorkload(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  agentActivity(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  agentConversion(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  agentProperty(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  salesVolume(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  salesCycle(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  revenue(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  averageDeal(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  sla(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
  forecastInput(
    query: AnalyticsQuery,
    scope: AnalyticsScope,
  ): Promise<readonly Record<string, unknown>[]>;
}

export const ANALYTICS_QUERY_PORT = Symbol('ANALYTICS_QUERY_PORT');
