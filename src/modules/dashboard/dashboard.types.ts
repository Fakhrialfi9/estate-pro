export interface DashboardPeriod {
  readonly from: string;
  readonly to: string;
}

export interface DashboardResponseMeta {
  readonly generatedAt: string;
  readonly period: DashboardPeriod;
  readonly timezone: 'UTC';
  readonly granularity: 'day' | 'week' | 'month';
}

export interface PropertyInventoryKpi {
  readonly status: string;
  readonly propertyType: string;
  readonly propertyCategory: string;
  readonly count: number;
}

export interface PropertyListingKpi {
  readonly transactionType: string;
  readonly status: string;
  readonly visibility: string;
  readonly featured: boolean;
  readonly premium: boolean;
  readonly count: number;
}

export interface PropertyLifecycleKpi {
  readonly created: number;
  readonly published: number;
  readonly verified: number;
  readonly deleted: number;
  readonly archived: number;
}

export interface PropertyAgingKpi {
  readonly averagePublishDays: number;
  readonly averageVerifyDays: number;
  readonly averageInactiveAgeDays: number;
}

export interface PropertyDashboardData {
  readonly inventory: readonly PropertyInventoryKpi[];
  readonly listings: readonly PropertyListingKpi[];
  readonly lifecycle: PropertyLifecycleKpi;
  readonly aging: PropertyAgingKpi;
}

export interface CrmLeadVolumeKpi {
  readonly period: string;
  readonly status: string;
  readonly count: number;
}

export interface CrmFunnelKpi {
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
}

export interface CrmAssignmentKpi {
  readonly ownerUserUuid: string;
  readonly count: number;
}

export interface CrmLifecycleKpi {
  readonly created: number;
  readonly qualified: number;
  readonly closed: number;
  readonly converted: number;
  readonly lifecycleEvents: number;
}

export interface CrmAgingKpi {
  readonly openCount: number;
  readonly averageAgeDays: number;
  readonly medianAgeDays: number;
}

export interface CrmAcquisitionKpi {
  readonly sourceUuid?: string;
  readonly sourceCode?: string;
  readonly sourceName?: string;
  readonly campaignUuid?: string;
  readonly campaignCode?: string;
  readonly campaignName?: string;
  readonly sourceCodeFromCampaign?: string;
  readonly leads: number;
  readonly qualified: number;
  readonly converted: number;
  readonly qualifiedRate: number;
  readonly conversionRate: number;
}

export interface CrmSlaKpi {
  readonly averageResponseHours: number;
  readonly averageQualificationHours: number;
  readonly qualificationThresholdHours: number;
  readonly responseSla: {
    readonly averageHours: number;
    readonly thresholdHours: number;
  };
  readonly qualificationSla: {
    readonly averageHours: number;
    readonly thresholdHours: number;
  };
}

export interface CrmDashboardData {
  readonly volume: readonly CrmLeadVolumeKpi[];
  readonly lifecycle: CrmLifecycleKpi;
  readonly aging: CrmAgingKpi;
  readonly funnel: readonly CrmFunnelKpi[];
  readonly assignments: readonly CrmAssignmentKpi[];
  readonly sources: readonly CrmAcquisitionKpi[];
  readonly campaigns: readonly CrmAcquisitionKpi[];
  readonly conversion: {
    readonly leadToOpportunity: {
      readonly leads: number;
      readonly opportunities: number;
      readonly rate: number;
    };
    readonly opportunityToDeal: {
      readonly opportunities: number;
      readonly wonDeals: number;
      readonly rate: number;
    };
    readonly cycleTime: {
      readonly leadToOpportunityDays: number;
      readonly opportunityToCloseDays: number;
    };
  };
  readonly sla: CrmSlaKpi;
}

export interface SalesPipelineKpi {
  readonly pipelineUuid: string | null;
  readonly pipelineName: string | null;
  readonly stageUuid: string | null;
  readonly stageCode: string | null;
  readonly stageName: string | null;
  readonly probability: number;
  readonly opportunities: number;
  readonly totalValue: string;
  readonly weightedValue: string;
}

export interface SalesVelocityKpi {
  readonly stageUuid: string | null;
  readonly averageDays: number;
  readonly transitions: number;
}

export interface SalesAgingKpi {
  readonly stageUuid: string | null;
  readonly count: number;
  readonly averageAgeDays: number;
  readonly maxAgeDays: number;
}

export interface SalesValueKpi {
  readonly currency: string;
  readonly opportunities: number;
  readonly totalValue: string;
  readonly averageValue: string;
}

export interface SalesVolumeKpi {
  readonly period?: string;
  readonly status?: string;
  readonly count: number;
  readonly totalAmount?: string;
}

export interface SalesRevenueKpi {
  readonly currency: string;
  readonly amount: string;
  readonly count?: number;
}

export interface SalesAverageDealKpi {
  readonly currency: string;
  readonly averageAmount: string;
  readonly deals?: number;
}

export interface SalesForecastKpi {
  readonly target: 'expected-revenue';
  readonly forecast: number;
  readonly methodology: string;
  readonly confidence: 'NORMAL' | 'INSUFFICIENT_DATA';
  readonly minimumHistoricalDeals: number;
  readonly historicalAverageDeal: number;
  readonly weightedPipeline: number;
}

export interface SalesDashboardData {
  readonly pipeline: readonly SalesPipelineKpi[];
  readonly stageVelocity: readonly SalesVelocityKpi[];
  readonly aging: readonly SalesAgingKpi[];
  readonly value: readonly SalesValueKpi[];
  readonly conversion: CrmDashboardData['conversion'];
  readonly revenue?: readonly SalesRevenueKpi[];
  readonly averageDeal?: readonly SalesAverageDealKpi[];
  readonly sales?: readonly SalesVolumeKpi[];
  readonly forecast?: SalesForecastKpi;
}

export interface AgentWorkloadKpi {
  readonly agentUuid: string;
  readonly displayName: string;
  readonly leads: number;
  readonly opportunities: number;
  readonly properties: number;
  readonly activities: number;
}

export interface AgentActivityKpi {
  readonly agentUuid: string;
  readonly type: string;
  readonly status: string;
  readonly count: number;
  readonly category: string;
}

export interface AgentConversionKpi {
  readonly agentUuid: string;
  readonly opportunities: number;
  readonly wonDeals: number;
  readonly revenue?: string;
}

export interface AgentPropertyKpi {
  readonly agentUuid: string;
  readonly activeProperties: number;
  readonly publishedProperties: number;
}

export interface AgentScorecardKpi {
  readonly agentUuid: string;
  readonly displayName: string;
  readonly leads: number;
  readonly opportunities: number;
  readonly properties: number;
  readonly activities: number;
  readonly activeProperties: number;
  readonly publishedProperties: number;
  readonly wonDeals: number;
  readonly conversionRate: number;
  readonly revenue?: string;
}

export interface AgentDashboardData {
  readonly workload: readonly AgentWorkloadKpi[];
  readonly activity: readonly AgentActivityKpi[];
  readonly conversion: readonly AgentConversionKpi[];
  readonly propertiesByAgent: readonly AgentPropertyKpi[];
  readonly scorecards: readonly AgentScorecardKpi[];
}

export type OperationalComponentStatus = 'up' | 'down' | 'unknown';

export interface DashboardOperationalResponse {
  readonly generatedAt: string;
  readonly status: 'ok' | 'degraded';
  readonly maintenanceMode: boolean;
  readonly readOnlyMode: boolean;
  readonly components: Readonly<Record<string, OperationalComponentStatus>>;
}

export interface DashboardSectionResponse<T> extends DashboardResponseMeta {
  readonly data: T;
}

export interface ExecutiveDashboardResponse extends DashboardResponseMeta {
  readonly kpi: {
    readonly property: PropertyDashboardData;
    readonly crm: CrmDashboardData;
    readonly sales: SalesDashboardData;
    readonly agents: AgentDashboardData;
  };
  readonly operations: {
    readonly status: 'ok' | 'degraded';
    readonly components: Readonly<Record<string, OperationalComponentStatus>>;
  };
}
