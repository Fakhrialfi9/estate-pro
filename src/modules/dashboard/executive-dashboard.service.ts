import { Inject, Injectable } from '@nestjs/common';
import type { AccessTokenClaims } from '../../common/security/access-token-verifier.port.js';
import {
  SYSTEM_OPERATIONS_PORT,
  type SystemOperationsPort,
} from '../system/system.module.js';
import { AnalyticsService } from '../analytics/analytics.module.js';
import type { ExecutiveDashboardQueryDto } from './executive-dashboard.query.dto.js';
import type {
  AgentActivityKpi,
  AgentConversionKpi,
  AgentDashboardData,
  AgentPropertyKpi,
  AgentScorecardKpi,
  AgentWorkloadKpi,
  CrmAcquisitionKpi,
  CrmAssignmentKpi,
  CrmConversionKpi,
  CrmDashboardData,
  CrmFunnelKpi,
  CrmLeadVolumeKpi,
  CrmLifecycleKpi,
  CrmAgingKpi,
  CrmSlaKpi,
  DashboardOperationalResponse,
  DashboardPeriod,
  DashboardSectionResponse,
  ExecutiveDashboardResponse,
  PropertyAgingKpi,
  PropertyDashboardData,
  PropertyInventoryKpi,
  PropertyLifecycleKpi,
  PropertyListingKpi,
  SalesAgingKpi,
  SalesAverageDealKpi,
  SalesDashboardData,
  SalesForecastKpi,
  SalesPipelineKpi,
  SalesRevenueKpi,
  SalesVelocityKpi,
  SalesValueKpi,
  SalesVolumeKpi,
} from './dashboard.types.js';

type AnalyticsRow = Readonly<Record<string, unknown>>;

const ANALYTICS_GLOBAL_PERMISSIONS = new Set([
  'analytics.revenue.read',
  'analytics.read.all',
  'analytics.manage',
]);

@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly analytics: AnalyticsService,
    @Inject(SYSTEM_OPERATIONS_PORT)
    private readonly operations: SystemOperationsPort,
  ) {}

  async get(
    query: ExecutiveDashboardQueryDto,
    user: AccessTokenClaims,
  ): Promise<ExecutiveDashboardResponse> {
    const [property, crm, sales, agents, diagnostics] = await Promise.all([
      this.getProperty(query, user),
      this.getCrm(query, user),
      this.getSales(query, user),
      this.getAgent(query, user),
      this.operations.diagnostics(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      period: property.period,
      timezone: property.timezone,
      granularity: property.granularity,
      kpi: {
        property: property.data,
        crm: crm.data,
        sales: sales.data,
        agents: agents.data,
      },
      operations: {
        status: diagnostics.status,
        components: diagnostics.components,
      },
    };
  }

  async getProperty(
    query: ExecutiveDashboardQueryDto,
    user: AccessTokenClaims,
  ): Promise<DashboardSectionResponse<PropertyDashboardData>> {
    const report = await this.analytics.property(query, user);
    const row = this.firstRow(report.data);
    return {
      ...this.meta(report.meta),
      data: {
        inventory: this.mapPropertyInventory(this.rows(row.inventory)),
        listings: this.mapPropertyListings(this.rows(row.listings)),
        lifecycle: this.mapPropertyLifecycle(this.firstRow(row.lifecycle)),
        aging: this.mapPropertyAging(this.firstRow(row.aging)),
      },
    };
  }

  async getCrm(
    query: ExecutiveDashboardQueryDto,
    user: AccessTokenClaims,
  ): Promise<DashboardSectionResponse<CrmDashboardData>> {
    const [leads, acquisition, conversion, sla] = await Promise.all([
      this.analytics.leads(query, user),
      this.analytics.acquisition(query, user),
      this.analytics.conversion(query, user),
      this.analytics.sla(query, user),
    ]);
    const leadData = this.firstRow(leads.data);
    const acquisitionData = this.firstRow(acquisition.data);
    const conversionData = this.firstRow(conversion.data);
    const slaData = this.firstRow(sla.data);

    return {
      ...this.meta(leads.meta),
      data: {
        volume: this.mapLeadVolume(this.rows(leadData.volume)),
        lifecycle: this.mapCrmLifecycle(this.firstRow(leadData.lifecycle)),
        aging: this.mapCrmAging(this.firstRow(leadData.aging)),
        funnel: this.mapCrmFunnel(this.rows(leadData.funnel)),
        assignments: this.mapCrmAssignments(this.rows(leadData.assignments)),
        sources: this.mapAcquisition(this.rows(acquisitionData.sources)),
        campaigns: this.mapAcquisition(
          this.rows(acquisitionData.campaigns),
          true,
        ),
        conversion: this.mapCrmConversion(conversionData),
        sla: this.mapCrmSla(slaData),
      },
    };
  }

  async getSales(
    query: ExecutiveDashboardQueryDto,
    user: AccessTokenClaims,
  ): Promise<DashboardSectionResponse<SalesDashboardData>> {
    const [pipeline, conversion] = await Promise.all([
      this.analytics.pipeline(query, user),
      this.analytics.conversion(query, user),
    ]);
    const pipelineData = this.firstRow(pipeline.data);
    const data: SalesDashboardData = {
      pipeline: this.mapSalesPipeline(this.rows(pipelineData.pipeline)),
      stageVelocity: this.mapSalesVelocity(
        this.rows(pipelineData.stageVelocity),
      ),
      aging: this.mapSalesAging(this.rows(pipelineData.aging)),
      value: this.mapSalesValue(this.rows(pipelineData.value)),
      conversion: this.mapCrmConversion(this.firstRow(conversion.data)),
    };

    if (this.canReadRevenue(user)) {
      const revenue = await this.analytics.salesAndRevenue(query, user);
      const revenueData = this.firstRow(revenue.data);
      data.sales = this.mapSalesVolume(this.rows(revenueData.sales));
      data.revenue = this.mapSalesRevenue(this.rows(revenueData.revenue));
      data.averageDeal = this.mapAverageDeal(
        this.rows(revenueData.averageDeal),
      );
    }

    if (this.canForecast(user)) {
      const forecast = await this.analytics.forecast(query, user);
      data.forecast = this.mapForecast(this.firstRow(forecast.data));
    }

    return {
      ...this.meta(pipeline.meta),
      data,
    };
  }

  async getAgent(
    query: ExecutiveDashboardQueryDto,
    user: AccessTokenClaims,
  ): Promise<DashboardSectionResponse<AgentDashboardData>> {
    const report = await this.analytics.agent(query, user);
    const row = this.firstRow(report.data);
    const canReadRevenue = this.canReadRevenue(user);
    return {
      ...this.meta(report.meta),
      data: {
        workload: this.mapAgentWorkload(this.rows(row.workload)),
        activity: this.mapAgentActivity(this.rows(row.activity)),
        conversion: this.mapAgentConversion(
          this.rows(row.conversion),
          canReadRevenue,
        ),
        propertiesByAgent: this.mapAgentProperties(
          this.rows(row.propertiesByAgent),
        ),
        scorecards: this.mapAgentScorecards(
          this.rows(row.scorecards),
          canReadRevenue,
        ),
      },
    };
  }

  async getOperational(): Promise<DashboardOperationalResponse> {
    const diagnostics = await this.operations.diagnostics();
    return {
      generatedAt: new Date().toISOString(),
      status: diagnostics.status,
      maintenanceMode: diagnostics.maintenanceMode,
      readOnlyMode: diagnostics.readOnlyMode,
      components: diagnostics.components,
    };
  }

  private meta(meta: {
    generatedAt: string;
    from: string;
    to: string;
    timezone: 'UTC';
    granularity: 'day' | 'week' | 'month';
  }) {
    const period: DashboardPeriod = { from: meta.from, to: meta.to };
    return {
      generatedAt: meta.generatedAt,
      period,
      timezone: meta.timezone,
      granularity: meta.granularity,
    };
  }

  private firstRow(value: unknown): AnalyticsRow {
    if (Array.isArray(value)) {
      const first = value[0];
      return this.isRow(first) ? first : {};
    }
    return this.isRow(value) ? value : {};
  }

  private rows(value: unknown): AnalyticsRow[] {
    return Array.isArray(value)
      ? value.filter((item): item is AnalyticsRow => this.isRow(item))
      : [];
  }

  private isRow(value: unknown): value is AnalyticsRow {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private string(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  private stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private number(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private money(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value))
      return String(value);
    if (typeof value === 'bigint') return value.toString();
    return '0';
  }

  private boolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  private mapPropertyInventory(rows: AnalyticsRow[]): PropertyInventoryKpi[] {
    return rows.map((row) => ({
      status: this.string(row.status),
      propertyType: this.string(row.propertyType),
      propertyCategory: this.string(row.propertyCategory),
      count: this.number(row.count),
    }));
  }

  private mapPropertyListings(rows: AnalyticsRow[]): PropertyListingKpi[] {
    return rows.map((row) => ({
      transactionType: this.string(row.transactionType),
      status: this.string(row.status),
      visibility: this.string(row.visibility),
      featured: this.boolean(row.featured),
      premium: this.boolean(row.premium),
      count: this.number(row.count),
    }));
  }

  private mapPropertyLifecycle(row: AnalyticsRow): PropertyLifecycleKpi {
    return {
      created: this.number(row.created),
      published: this.number(row.published),
      verified: this.number(row.verified),
      deleted: this.number(row.deleted),
      archived: this.number(row.archived),
    };
  }

  private mapPropertyAging(row: AnalyticsRow): PropertyAgingKpi {
    return {
      averagePublishDays: this.number(row.averagePublishDays),
      averageVerifyDays: this.number(row.averageVerifyDays),
      averageInactiveAgeDays: this.number(row.averageInactiveAgeDays),
    };
  }

  private mapLeadVolume(rows: AnalyticsRow[]): CrmLeadVolumeKpi[] {
    return rows.map((row) => ({
      period: this.string(row.period),
      status: this.string(row.status),
      count: this.number(row.count),
    }));
  }

  private mapCrmLifecycle(row: AnalyticsRow): CrmLifecycleKpi {
    return {
      created: this.number(row.created),
      qualified: this.number(row.qualified),
      closed: this.number(row.closed),
      converted: this.number(row.converted),
      lifecycleEvents: this.number(row.lifecycleEvents),
    };
  }

  private mapCrmAging(row: AnalyticsRow): CrmAgingKpi {
    return {
      openCount: this.number(row.openCount),
      averageAgeDays: this.number(row.averageAgeDays),
      medianAgeDays: this.number(row.medianAgeDays),
    };
  }

  private mapCrmFunnel(rows: AnalyticsRow[]): CrmFunnelKpi[] {
    return rows.map((row) => ({
      status: this.string(row.status),
      count: this.number(row.count),
      percentage: this.number(row.percentage),
    }));
  }

  private mapCrmAssignments(rows: AnalyticsRow[]): CrmAssignmentKpi[] {
    return rows.map((row) => ({
      ownerUserUuid: this.string(row.ownerUserUuid),
      count: this.number(row.count),
    }));
  }

  private mapAcquisition(
    rows: AnalyticsRow[],
    campaign = false,
  ): CrmAcquisitionKpi[] {
    return rows.map((row) => ({
      ...(campaign
        ? {
            campaignUuid: this.string(row.campaignUuid),
            campaignCode: this.string(row.campaignCode),
            campaignName: this.string(row.campaignName),
            sourceCodeFromCampaign: this.string(row.sourceCode),
          }
        : {
            sourceUuid: this.string(row.sourceUuid),
            sourceCode: this.string(row.sourceCode),
            sourceName: this.string(row.sourceName),
          }),
      leads: this.number(row.leads),
      qualified: this.number(row.qualified),
      converted: this.number(row.converted),
      qualifiedRate: this.number(row.qualifiedRate),
      conversionRate: this.number(row.conversionRate),
    }));
  }

  private mapCrmConversion(row: AnalyticsRow): CrmConversionKpi {
    const leadToOpportunity = this.firstRow(row.leadToOpportunity);
    const opportunityToDeal = this.firstRow(row.opportunityToDeal);
    const cycleTime = this.firstRow(row.cycleTime);
    return {
      leadToOpportunity: {
        leads: this.number(leadToOpportunity.leads),
        opportunities: this.number(leadToOpportunity.opportunities),
        rate: this.number(leadToOpportunity.rate),
      },
      opportunityToDeal: {
        opportunities: this.number(opportunityToDeal.opportunities),
        wonDeals: this.number(opportunityToDeal.wonDeals),
        rate: this.number(opportunityToDeal.rate),
      },
      cycleTime: {
        leadToOpportunityDays: this.number(cycleTime.leadToOpportunityDays),
        opportunityToCloseDays: this.number(cycleTime.opportunityToCloseDays),
      },
    };
  }

  private mapCrmSla(row: AnalyticsRow): CrmSlaKpi {
    const response = this.firstRow(row.responseSla);
    const qualification = this.firstRow(row.qualificationSla);
    return {
      leads: this.number(row.leads),
      qualificationCompliant: this.number(row.qualificationCompliant),
      qualificationBreached: this.number(row.qualificationBreached),
      averageResponseHours: this.number(row.averageResponseHours),
      averageQualificationHours: this.number(row.averageQualificationHours),
      qualificationThresholdHours: this.number(row.qualificationThresholdHours),
      responseSla: {
        averageHours: this.number(response.averageHours),
        thresholdHours: this.number(response.thresholdHours),
      },
      qualificationSla: {
        averageHours: this.number(qualification.averageHours),
        thresholdHours: this.number(qualification.thresholdHours),
      },
    };
  }

  private mapSalesPipeline(rows: AnalyticsRow[]): SalesPipelineKpi[] {
    return rows.map((row) => ({
      pipelineUuid: this.stringOrNull(row.pipelineUuid),
      pipelineName: this.stringOrNull(row.pipelineName),
      stageUuid: this.stringOrNull(row.stageUuid),
      stageCode: this.stringOrNull(row.stageCode),
      stageName: this.stringOrNull(row.stageName),
      probability: this.number(row.probability),
      opportunities: this.number(row.opportunities),
      totalValue: this.money(row.totalValue),
      weightedValue: this.money(row.weightedValue),
    }));
  }

  private mapSalesVelocity(rows: AnalyticsRow[]): SalesVelocityKpi[] {
    return rows.map((row) => ({
      stageUuid: this.stringOrNull(row.stageUuid),
      averageDays: this.number(row.averageDays),
      transitions: this.number(row.transitions),
    }));
  }

  private mapSalesAging(rows: AnalyticsRow[]): SalesAgingKpi[] {
    return rows.map((row) => ({
      stageUuid: this.stringOrNull(row.stageUuid),
      count: this.number(row.count),
      averageAgeDays: this.number(row.averageAgeDays),
      maxAgeDays: this.number(row.maxAgeDays),
    }));
  }

  private mapSalesValue(rows: AnalyticsRow[]): SalesValueKpi[] {
    return rows.map((row) => ({
      currency: this.stringOrNull(row.currency),
      totalValue: this.money(row.totalValue),
      weightedValue: this.money(row.weightedValue),
      opportunities: this.number(row.opportunities),
    }));
  }

  private mapSalesVolume(rows: AnalyticsRow[]): SalesVolumeKpi[] {
    return rows.map((row) => ({
      period: this.string(row.period),
      currency: this.stringOrNull(row.currency),
      deals: this.number(row.deals),
      wonDeals: this.number(row.wonDeals),
      lostDeals: this.number(row.lostDeals),
      closedRevenue: this.money(row.closedRevenue),
    }));
  }

  private mapSalesRevenue(rows: AnalyticsRow[]): SalesRevenueKpi[] {
    return rows.map((row) => ({
      period: this.string(row.period),
      currency: this.string(row.currency),
      closedRevenue: this.money(row.closedRevenue),
      deals: this.number(row.deals),
    }));
  }

  private mapAverageDeal(rows: AnalyticsRow[]): SalesAverageDealKpi[] {
    return rows.map((row) => ({
      currency: this.string(row.currency),
      deals: this.number(row.deals),
      averageValue: this.money(row.averageValue),
      minValue: this.money(row.minValue),
      maxValue: this.money(row.maxValue),
    }));
  }

  private mapForecast(row: AnalyticsRow): SalesForecastKpi {
    return {
      target: this.string(row.target),
      forecast: this.number(row.forecast),
      methodology: this.string(row.methodology),
      confidence: this.string(row.confidence),
      minimumHistoricalDeals: this.number(row.minimumHistoricalDeals),
      historicalAverageDeal: this.number(row.historicalAverageDeal),
      weightedPipeline: this.number(row.weightedPipeline),
    };
  }

  private mapAgentWorkload(rows: AnalyticsRow[]): AgentWorkloadKpi[] {
    return rows.map((row) => ({
      agentUuid: this.string(row.agentUuid),
      displayName: this.string(row.displayName),
      leads: this.number(row.leads),
      opportunities: this.number(row.opportunities),
      properties: this.number(row.properties),
      activities: this.number(row.activities),
    }));
  }

  private mapAgentActivity(rows: AnalyticsRow[]): AgentActivityKpi[] {
    return rows.map((row) => ({
      agentUuid: this.string(row.agentUuid),
      type: this.string(row.type),
      status: this.string(row.status),
      count: this.number(row.count),
      category: this.string(row.category, 'OTHER'),
    }));
  }

  private mapAgentConversion(
    rows: AnalyticsRow[],
    canReadRevenue: boolean,
  ): AgentConversionKpi[] {
    return rows.map((row) => ({
      agentUuid: this.string(row.agentUuid),
      opportunities: this.number(row.opportunities),
      wonDeals: this.number(row.wonDeals),
      ...(canReadRevenue ? { revenue: this.money(row.revenue) } : {}),
    }));
  }

  private mapAgentProperties(rows: AnalyticsRow[]): AgentPropertyKpi[] {
    return rows.map((row) => ({
      agentUuid: this.string(row.agentUuid),
      activeProperties: this.number(row.activeProperties),
      publishedProperties: this.number(row.publishedProperties),
    }));
  }

  private mapAgentScorecards(
    rows: AnalyticsRow[],
    canReadRevenue: boolean,
  ): AgentScorecardKpi[] {
    return rows.map((row) => ({
      agentUuid: this.string(row.agentUuid),
      displayName: this.string(row.displayName),
      leads: this.number(row.leads),
      opportunities: this.number(row.opportunities),
      properties: this.number(row.properties),
      activities: this.number(row.activities),
      activeProperties: this.number(row.activeProperties),
      publishedProperties: this.number(row.publishedProperties),
      wonDeals: this.number(row.wonDeals),
      conversionRate: this.number(row.conversionRate),
      ...(canReadRevenue ? { revenue: this.money(row.revenue) } : {}),
    }));
  }

  private canReadRevenue(user: AccessTokenClaims): boolean {
    return (user.permissions ?? []).some((permission) =>
      ANALYTICS_GLOBAL_PERMISSIONS.has(permission),
    );
  }

  private canForecast(user: AccessTokenClaims): boolean {
    return (
      (user.permissions ?? []).includes('analytics.forecast') ||
      (user.permissions ?? []).includes('analytics.manage')
    );
  }
}
