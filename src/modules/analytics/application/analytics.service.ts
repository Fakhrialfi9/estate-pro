import { Inject, Injectable } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import type { AccessTokenClaims } from '../../../common/security/access-token-verifier.port.js';
import {
  AnalyticsInvalidQueryException,
  AnalyticsQueryTimeoutException,
  AnalyticsScopeException,
  AnalyticsUnavailableException,
} from '../domain/errors/analytics.errors.js';
import {
  ANALYTICS_QUERY_PORT,
  type AnalyticsQuery,
  type AnalyticsQueryPort,
  type AnalyticsReport,
  type AnalyticsScope,
} from '../domain/analytics.types.js';
import { AnalyticsScopePolicy } from '../domain/policies/analytics-scope.policy.js';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto.js';

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;
const MAX_BOUNDED_ROWS = 5000;
const QUERY_TIMEOUT_MS = 10000;

const stringValue = (value: unknown): string =>
  typeof value === 'string' ? value : '';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_QUERY_PORT)
    private readonly queries: AnalyticsQueryPort,
    private readonly scopePolicy: AnalyticsScopePolicy,
  ) {}

  normalizeQuery(dto: AnalyticsQueryDto): AnalyticsQuery {
    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from >= to
    ) {
      throw new AnalyticsInvalidQueryException(
        '`from` must be earlier than `to`.',
      );
    }
    const rangeDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (rangeDays > MAX_RANGE_DAYS) {
      throw new AnalyticsInvalidQueryException(
        `The reporting range cannot exceed ${MAX_RANGE_DAYS} days.`,
      );
    }
    return {
      from,
      to,
      granularity: dto.granularity ?? 'day',
      page: Math.min(Math.max(dto.page ?? 1, 1), 50),
      limit: Math.min(Math.max(dto.limit ?? 50, 1), 100),
      ...(dto.ownerUserUuid ? { ownerUserUuid: dto.ownerUserUuid } : {}),
      ...(dto.sourceUuid ? { sourceUuid: dto.sourceUuid } : {}),
      ...(dto.campaignUuid ? { campaignUuid: dto.campaignUuid } : {}),
      ...(dto.pipelineUuid ? { pipelineUuid: dto.pipelineUuid } : {}),
      ...(dto.stageUuid ? { stageUuid: dto.stageUuid } : {}),
      ...(dto.propertyUuid ? { propertyUuid: dto.propertyUuid } : {}),
      ...(dto.currency ? { currency: dto.currency } : {}),
    };
  }

  scopeFor(user: AccessTokenClaims): AnalyticsScope {
    return this.scopePolicy.resolve(user);
  }

  async leads(
    dto: AnalyticsQueryDto,
    user: AccessTokenClaims,
  ): Promise<AnalyticsReport<Record<string, unknown>>> {
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const [volume, lifecycle, aging, funnel, assignment] =
      await this.withTimeout(
        Promise.all([
          this.queries.leadVolume(query, scope),
          this.queries.leadLifecycle(query, scope),
          this.queries.leadAging(query, scope),
          this.queries.leadFunnel(query, scope),
          this.queries.leadAssignment(query, scope),
        ]),
      );
    const funnelRows = this.normalizeRows(funnel);
    const funnelTotal = funnelRows.reduce(
      (sum, row) => sum + this.numberValue(row.count),
      0,
    );
    const funnelWithRates = funnelRows.map((row) => ({
      ...row,
      percentage:
        funnelTotal === 0
          ? 0
          : Number(
              ((this.numberValue(row.count) / funnelTotal) * 100).toFixed(4),
            ),
    }));
    return this.report(query, {
      volume: this.normalizeRows(volume),
      lifecycle: this.normalizeRows(lifecycle)[0] ?? {},
      aging: this.normalizeRows(aging)[0] ?? {},
      funnel: funnelWithRates,
      assignments: this.normalizeRows(assignment),
    });
  }

  async acquisition(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const [sources, campaigns] = await this.withTimeout(
      Promise.all([
        this.queries.sourcePerformance(query, scope),
        this.queries.campaignPerformance(query, scope),
      ]),
    );
    return this.report(query, {
      sources: this.normalizeRows(sources).map((row) =>
        this.withConversionRates(row),
      ),
      campaigns: this.normalizeRows(campaigns).map((row) =>
        this.withConversionRates(row),
      ),
    });
  }

  async conversion(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const [result, cohort] = await this.withTimeout(
      Promise.all([
        this.queries.conversion(query, scope),
        this.queries.cohort(query, scope),
      ]),
    );
    const row = this.normalizeRows(result)[0] ?? {};
    const leads = this.numberValue(row.leads);
    const opportunities = this.numberValue(row.opportunities);
    const wonDeals = this.numberValue(row.wonDeals);
    return this.report(query, {
      leadToOpportunity: {
        leads,
        opportunities,
        rate: leads ? Number(((opportunities / leads) * 100).toFixed(4)) : 0,
      },
      opportunityToDeal: {
        opportunities,
        wonDeals,
        rate: opportunities
          ? Number(((wonDeals / opportunities) * 100).toFixed(4))
          : 0,
      },
      cycleTime: {
        leadToOpportunityDays: this.numberValue(row.leadToOpportunityDays),
        opportunityToCloseDays: this.numberValue(row.opportunityToCloseDays),
      },
      cohorts: this.normalizeRows(cohort).map((item) => ({
        ...item,
        rate: this.numberValue(item.leads)
          ? Number(
              (
                (this.numberValue(item.converted) /
                  this.numberValue(item.leads)) *
                100
              ).toFixed(4),
            )
          : 0,
      })),
    });
  }

  async pipeline(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const [pipeline, velocity, aging, value] = await this.withTimeout(
      Promise.all([
        this.queries.pipeline(query, scope),
        this.queries.stageVelocity(query, scope),
        this.queries.opportunityAging(query, scope),
        this.queries.opportunityValue(query, scope),
      ]),
    );
    return this.report(query, {
      pipeline: this.normalizeRows(pipeline),
      stageVelocity: this.normalizeRows(velocity),
      aging: this.normalizeRows(aging),
      value: this.normalizeRows(value),
    });
  }

  async property(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const [inventory, listings, lifecycle, aging] = await this.withTimeout(
      Promise.all([
        this.queries.propertyInventory(query, scope),
        this.queries.listingAnalytics(query, scope),
        this.queries.propertyLifecycle(query, scope),
        this.queries.propertyAging(query, scope),
      ]),
    );
    return this.report(query, {
      inventory: this.normalizeRows(inventory),
      listings: this.normalizeRows(listings),
      lifecycle: this.normalizeRows(lifecycle)[0] ?? {},
      aging: this.normalizeRows(aging)[0] ?? {},
    });
  }

  async agent(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const [workload, activity, conversion, agentProperty] =
      await this.withTimeout(
        Promise.all([
          this.queries.agentWorkload(query, scope),
          this.queries.agentActivity(query, scope),
          this.queries.agentConversion(query, scope),
          this.queries.agentProperty(query, scope),
        ]),
      );
    const conversions = new Map(
      this.normalizeRows(conversion).map((row) => [
        stringValue(row.agentUuid),
        row,
      ]),
    );
    const properties = new Map(
      this.normalizeRows(agentProperty).map((row) => [
        stringValue(row.agentUuid),
        row,
      ]),
    );
    const canReadRevenue = this.scopePolicy.canReadRevenue(user);
    const scorecards = this.normalizeRows(workload).map((row) => {
      const id = stringValue(row.agentUuid);
      const c = conversions.get(id) ?? {};
      const p = properties.get(id) ?? {};
      const opportunities = this.numberValue(c.opportunities);
      const won = this.numberValue(c.wonDeals);
      const base = {
        ...row,
        activeProperties: this.numberValue(p.activeProperties),
        publishedProperties: this.numberValue(p.publishedProperties),
        wonDeals: won,
        conversionRate: opportunities
          ? Number(((won / opportunities) * 100).toFixed(4))
          : 0,
      };
      return canReadRevenue ? { ...base, revenue: c.revenue ?? '0' } : base;
    });
    const safeConversion = this.normalizeRows(conversion).map((row) => {
      if (canReadRevenue) return row;
      const safeRow = { ...row };
      delete safeRow.revenue;
      return safeRow;
    });
    return this.report(query, {
      workload: this.normalizeRows(workload),
      activity: this.normalizeRows(activity).map((row) => ({
        ...row,
        category: this.activityCategory(stringValue(row.type)),
      })),
      conversion: safeConversion,
      propertiesByAgent: this.normalizeRows(agentProperty),
      scorecards,
    });
  }

  async propertyAndAgent(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const [
      inventory,
      listings,
      lifecycle,
      aging,
      workload,
      activity,
      conversion,
      agentProperty,
    ] = await this.withTimeout(
      Promise.all([
        this.queries.propertyInventory(query, scope),
        this.queries.listingAnalytics(query, scope),
        this.queries.propertyLifecycle(query, scope),
        this.queries.propertyAging(query, scope),
        this.queries.agentWorkload(query, scope),
        this.queries.agentActivity(query, scope),
        this.queries.agentConversion(query, scope),
        this.queries.agentProperty(query, scope),
      ]),
    );
    const conversions = new Map(
      this.normalizeRows(conversion).map((row) => [
        stringValue(row.agentUuid),
        row,
      ]),
    );
    const properties = new Map(
      this.normalizeRows(agentProperty).map((row) => [
        stringValue(row.agentUuid),
        row,
      ]),
    );
    const canReadRevenue = this.scopePolicy.canReadRevenue(user);
    const scorecards = this.normalizeRows(workload).map((row) => {
      const id = stringValue(row.agentUuid);
      const c = conversions.get(id) ?? {};
      const p = properties.get(id) ?? {};
      const opportunities = this.numberValue(c.opportunities);
      const won = this.numberValue(c.wonDeals);
      const base = {
        ...row,
        activeProperties: this.numberValue(p.activeProperties),
        publishedProperties: this.numberValue(p.publishedProperties),
        wonDeals: won,
        conversionRate: opportunities
          ? Number(((won / opportunities) * 100).toFixed(4))
          : 0,
      };
      return canReadRevenue ? { ...base, revenue: c.revenue ?? '0' } : base;
    });
    const safeConversion = this.normalizeRows(conversion).map((row) => {
      if (canReadRevenue) return row;
      const safeRow = { ...row };
      delete safeRow.revenue;
      return safeRow;
    });
    return this.report(query, {
      inventory: this.normalizeRows(inventory),
      listings: this.normalizeRows(listings),
      lifecycle: this.normalizeRows(lifecycle)[0] ?? {},
      aging: this.normalizeRows(aging)[0] ?? {},
      workload: this.normalizeRows(workload),
      activity: this.normalizeRows(activity).map((row) => ({
        ...row,
        category: this.activityCategory(stringValue(row.type)),
      })),
      conversion: safeConversion,
      propertiesByAgent: this.normalizeRows(agentProperty),
      scorecards,
    });
  }

  async salesAndRevenue(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    if (!this.scopePolicy.canReadRevenue(user)) {
      throw new AnalyticsScopeException(
        'Revenue analytics permission is required.',
      );
    }
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const [sales, cycle, revenue, averageDeal] = await this.withTimeout(
      Promise.all([
        this.queries.salesVolume(query, scope),
        this.queries.salesCycle(query, scope),
        this.queries.revenue(query, scope),
        this.queries.averageDeal(query, scope),
      ]),
    );
    return this.report(query, {
      sales: this.normalizeRows(sales),
      cycle: this.normalizeRows(cycle)[0] ?? {},
      revenue: this.normalizeRows(revenue),
      averageDeal: this.normalizeRows(averageDeal),
    });
  }

  async sla(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const rows = this.normalizeRows(
      await this.withTimeout(this.queries.sla(query, scope)),
    );
    const row = rows[0] ?? {};
    return this.report(query, {
      ...row,
      qualificationThresholdHours: 48,
      responseSla: {
        averageHours: this.numberValue(row.averageResponseHours),
        thresholdHours: 24,
      },
      qualificationSla: {
        averageHours: this.numberValue(row.averageQualificationHours),
        thresholdHours: 48,
      },
    });
  }

  async forecast(dto: AnalyticsQueryDto, user: AccessTokenClaims) {
    if (!this.scopePolicy.canForecast(user)) {
      throw new AnalyticsScopeException('Forecast permission is required.');
    }
    const query = this.normalizeQuery(dto);
    const scope = this.scopeFor(user);
    const row =
      this.normalizeRows(
        await this.withTimeout(this.queries.forecastInput(query, scope)),
      )[0] ?? {};
    const closedRevenue = this.numberValue(row.closedRevenue);
    const closedDeals = this.numberValue(row.closedDeals);
    const weightedPipeline = this.numberValue(row.weightedPipeline);
    const historicalAverage = closedDeals ? closedRevenue / closedDeals : 0;
    const forecast = weightedPipeline + historicalAverage;
    return this.report(query, {
      target: 'expected-revenue',
      forecast: Number(forecast.toFixed(4)),
      methodology: 'weighted-open-pipeline-plus-historical-average-deal',
      confidence: closedDeals >= 5 ? 'NORMAL' : 'INSUFFICIENT_DATA',
      minimumHistoricalDeals: 5,
      historicalAverageDeal: Number(historicalAverage.toFixed(4)),
      weightedPipeline: Number(weightedPipeline.toFixed(4)),
    });
  }

  async exportCsv(
    dto: AnalyticsQueryDto,
    user: AccessTokenClaims,
    report: string,
  ): Promise<{ filename: string; content: string }> {
    if (!this.scopePolicy.canExport(user)) {
      throw new AnalyticsScopeException('Export permission is required.');
    }
    const normalized = report.trim().toLowerCase();
    let result: AnalyticsReport<Record<string, unknown>>;
    switch (normalized) {
      case 'leads':
        result = await this.leads(dto, user);
        break;
      case 'acquisition':
        result = await this.acquisition(dto, user);
        break;
      case 'conversion':
        result = await this.conversion(dto, user);
        break;
      case 'pipeline':
        result = await this.pipeline(dto, user);
        break;
      case 'property-agent':
        result = await this.propertyAndAgent(dto, user);
        break;
      case 'sales-revenue':
        result = await this.salesAndRevenue(dto, user);
        break;
      case 'sla':
        result = await this.sla(dto, user);
        break;
      case 'forecast':
        result = await this.forecast(dto, user);
        break;
      default:
        throw new AnalyticsInvalidQueryException(
          'Unsupported analytics export report.',
        );
    }
    const rows = this.flattenReport(result.data).slice(0, 10000);
    if (rows.length === 0) {
      return {
        filename: `analytics-${normalized}.csv`,
        content: '',
      };
    }
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const csv = [
      keys,
      ...rows.map((row) => keys.map((key) => this.csvValue(row[key]))),
    ]
      .map((row) => row.join(','))
      .join('\n');
    return {
      filename: `analytics-${normalized}.csv`,
      content: csv,
    };
  }

  private report<T extends Record<string, unknown>>(
    query: AnalyticsQuery,
    data: T,
  ): AnalyticsReport<T> {
    return {
      data: [data],
      meta: {
        generatedAt: new Date().toISOString(),
        from: query.from.toISOString(),
        to: query.to.toISOString(),
        timezone: 'UTC',
        granularity: query.granularity,
        page: query.page,
        limit: query.limit,
        total: 1,
      },
    };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    const span = trace.getActiveSpan();
    const startedAt = Date.now();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        span?.setAttribute('analytics.query.timeout', true);
        reject(new AnalyticsQueryTimeoutException());
      }, QUERY_TIMEOUT_MS);
      promise.then(
        (value) => {
          clearTimeout(timer);
          span?.setAttribute(
            'analytics.query.duration_ms',
            Date.now() - startedAt,
          );
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          span?.setAttribute(
            'analytics.query.duration_ms',
            Date.now() - startedAt,
          );
          reject(
            error instanceof Error
              ? error
              : new AnalyticsUnavailableException(),
          );
        },
      );
    });
  }

  private normalizeRows(
    rows: readonly Record<string, unknown>[],
  ): Record<string, unknown>[] {
    return rows
      .slice(0, MAX_BOUNDED_ROWS)
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            this.normalizeScalar(value),
          ]),
        ),
      );
  }

  private normalizeScalar(value: unknown): unknown {
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Date) return value.toISOString();
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') {
      const decimalLike = value as { toString(): string };
      const asString = decimalLike.toString();
      if (/^-?\d+(?:\.\d+)?$/.test(asString)) return asString;
    }
    return value;
  }

  private withConversionRates(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const leads = this.numberValue(row.leads);
    const qualified = this.numberValue(row.qualified);
    const converted = this.numberValue(row.converted);
    return {
      ...row,
      qualifiedRate: leads ? Number(((qualified / leads) * 100).toFixed(4)) : 0,
      conversionRate: leads
        ? Number(((converted / leads) * 100).toFixed(4))
        : 0,
    };
  }

  private numberValue(value: unknown): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  private activityCategory(type: string): string {
    const t = type.trim().toUpperCase();
    if (/(CALL|PHONE)/.test(t)) return 'CALL';
    if (/(EMAIL|WHATSAPP|MESSAGE|SMS)/.test(t)) return 'MESSAGE';
    if (/(VIEW|SHOWING|VISIT)/.test(t)) return 'VIEWING';
    if (/(NOTE|COMMENT)/.test(t)) return 'NOTE';
    return 'OTHER';
  }

  private flattenReport(
    data: readonly Record<string, unknown>[],
  ): Record<string, unknown>[] {
    return data.flatMap((group) =>
      Object.entries(group).flatMap(([key, value]) =>
        Array.isArray(value)
          ? value.filter(
              (item): item is Record<string, unknown> =>
                typeof item === 'object' && item !== null,
            )
          : [{ metric: key, value }],
      ),
    );
  }

  private csvValue(value: unknown): string {
    let text: string;
    if (value === null || value === undefined) {
      text = '';
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      text = value.toString();
    } else {
      text = JSON.stringify(value);
    }
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
