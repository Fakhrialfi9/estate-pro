import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { AnalyticsQuery, AnalyticsQueryPort, AnalyticsScope } from '../../analytics/domain/analytics.types.js';

const dayBucket = (column: string): string => `DATE(${column})`;
const weekBucket = (column: string): string => `DATE_FORMAT(${column}, '%x-%v')`;
const monthBucket = (column: string): string => `DATE_FORMAT(${column}, '%Y-%m')`;

@Injectable()
export class PrismaAnalyticsQueryRepository implements AnalyticsQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  private bucket(column: string, query: AnalyticsQuery): string {
    switch (query.granularity) {
      case 'day': return dayBucket(column);
      case 'week': return weekBucket(column);
      case 'month': return monthBucket(column);
    }
  }

  private async raw<T extends Record<string, unknown>>(sql: Prisma.Sql): Promise<readonly T[]> {
    return this.prisma.$queryRaw<T[]>(sql);
  }

  private crmScope(scope: AnalyticsScope, alias = 'l'): Prisma.Sql {
    if (scope.kind === 'global') return Prisma.sql`1 = 1`;
    return Prisma.sql`(${Prisma.raw(`${alias}.owner_user_uuid`)} = ${scope.userUuid} OR EXISTS (SELECT 1 FROM crm_lead_assignments la WHERE la.lead_id = ${Prisma.raw(`${alias}.id`)} AND la.assignee_user_uuid = ${scope.userUuid} AND la.unassigned_at IS NULL))`;
  }

  private salesScope(scope: AnalyticsScope, alias = 'o'): Prisma.Sql {
    if (scope.kind === 'global') return Prisma.sql`1 = 1`;
    return Prisma.sql`${Prisma.raw(`${alias}.owner_user_uuid`)} = ${scope.userUuid}`;
  }

  private propertyScope(scope: AnalyticsScope, alias = 'p'): Prisma.Sql {
    if (scope.kind === 'global') return Prisma.sql`1 = 1`;
    return Prisma.sql`(${Prisma.raw(`${alias}.created_by`)} = ${scope.userUuid} OR EXISTS (SELECT 1 FROM property_agent_assignments pa WHERE pa.property_id = ${Prisma.raw(`${alias}.id`)} AND pa.agent_user_uuid = ${scope.userUuid} AND pa.unassigned_at IS NULL))`;
  }

  private range(column: string, query: AnalyticsQuery): Prisma.Sql {
    return Prisma.sql`${Prisma.raw(column)} >= ${query.from} AND ${Prisma.raw(column)} < ${query.to}`;
  }

  async leadVolume(query: AnalyticsQuery, scope: AnalyticsScope) {
    const bucket = this.bucket('l.created_at', query);
    return this.raw(Prisma.sql`SELECT ${Prisma.raw(bucket)} AS period, s.code AS status, COUNT(*) AS count FROM crm_leads l JOIN crm_lead_statuses s ON s.id = l.status_id WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)} GROUP BY ${Prisma.raw(bucket)}, s.code ORDER BY period ASC LIMIT 5001`);
  }

  async leadLifecycle(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COUNT(*) AS created, SUM(l.qualified_at IS NOT NULL) AS qualified, SUM(l.closed_at IS NOT NULL) AS closed, SUM(l.converted_at IS NOT NULL) AS converted, COUNT(h.id) AS lifecycleEvents FROM crm_leads l LEFT JOIN crm_lead_history h ON h.lead_id = l.id WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)}`);
  }

  async leadAging(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COUNT(*) AS openCount, COALESCE(AVG(DATEDIFF(${query.to}, l.created_at)), 0) AS averageAgeDays, COALESCE((SELECT AVG(x.ageDays) FROM (SELECT DATEDIFF(${query.to}, l2.created_at) ageDays, ROW_NUMBER() OVER (ORDER BY l2.created_at, l2.id) rn, COUNT(*) OVER () cnt FROM crm_leads l2 WHERE l2.closed_at IS NULL AND l2.archived_at IS NULL AND l2.created_at < ${query.to} AND ${this.crmScope(scope, 'l2')}) x WHERE x.rn IN (FLOOR((x.cnt + 1) / 2), CEIL((x.cnt + 1) / 2))), 0) AS medianAgeDays FROM crm_leads l WHERE l.closed_at IS NULL AND l.archived_at IS NULL AND ${this.crmScope(scope)}`);
  }

  async leadFunnel(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT s.code AS status, COUNT(*) AS count FROM crm_leads l JOIN crm_lead_statuses s ON s.id = l.status_id WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)} GROUP BY s.code ORDER BY s.code ASC`);
  }

  async leadAssignment(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COALESCE(l.owner_user_uuid, la.assignee_user_uuid) AS ownerUserUuid, COUNT(DISTINCT l.id) AS count FROM crm_leads l LEFT JOIN crm_lead_assignments la ON la.lead_id = l.id AND la.unassigned_at IS NULL WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)} GROUP BY ownerUserUuid ORDER BY count DESC LIMIT 5001`);
  }

  async sourcePerformance(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT s.uuid AS sourceUuid, s.code AS sourceCode, s.name AS sourceName, COUNT(l.id) AS leads, SUM(l.qualified_at IS NOT NULL) AS qualified, SUM(l.converted_at IS NOT NULL) AS converted FROM crm_leads l JOIN crm_lead_sources s ON s.id = l.source_id WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)} ${query.sourceUuid ? Prisma.sql`AND s.uuid = ${query.sourceUuid}` : Prisma.sql``} GROUP BY s.uuid, s.code, s.name ORDER BY leads DESC LIMIT 5001`);
  }

  async campaignPerformance(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT c.uuid AS campaignUuid, c.code AS campaignCode, c.name AS campaignName, s.code AS sourceCode, COUNT(l.id) AS leads, SUM(l.qualified_at IS NOT NULL) AS qualified, SUM(l.converted_at IS NOT NULL) AS converted, COALESCE(SUM(CASE WHEN d.status = 'WON' THEN d.total_amount ELSE 0 END), 0) AS realizedRevenue FROM crm_leads l JOIN crm_lead_campaigns c ON c.id = l.campaign_id JOIN crm_lead_sources s ON s.id = l.source_id LEFT JOIN sales_opportunities o ON o.lead_uuid = l.uuid LEFT JOIN sales_deals d ON d.opportunity_uuid = o.uuid WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)} ${query.campaignUuid ? Prisma.sql`AND c.uuid = ${query.campaignUuid}` : Prisma.sql``} GROUP BY c.uuid, c.code, c.name, s.code ORDER BY leads DESC LIMIT 5001`);
  }

  async conversion(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COUNT(DISTINCT l.id) AS leads, COUNT(DISTINCT o.id) AS opportunities, COUNT(DISTINCT CASE WHEN d.status = 'WON' THEN d.id END) AS wonDeals, COALESCE(AVG(TIMESTAMPDIFF(SECOND, l.created_at, o.created_at)) / 86400, 0) AS leadToOpportunityDays, COALESCE(AVG(CASE WHEN sc.closed_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, o.created_at, sc.closed_at) / 86400 END), 0) AS opportunityToCloseDays FROM crm_leads l LEFT JOIN sales_opportunities o ON o.lead_uuid = l.uuid LEFT JOIN sales_deals d ON d.opportunity_uuid = o.uuid LEFT JOIN sales_closings sc ON sc.deal_uuid = d.uuid WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)}`);
  }

  async cohort(query: AnalyticsQuery, scope: AnalyticsScope) {
    const bucket = this.bucket('l.created_at', query);
    return this.raw(Prisma.sql`SELECT ${Prisma.raw(bucket)} AS cohort, COUNT(*) AS leads, SUM(l.converted_at IS NOT NULL AND l.converted_at < ${query.to}) AS converted FROM crm_leads l WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)} GROUP BY ${Prisma.raw(bucket)} ORDER BY cohort ASC LIMIT 5001`);
  }

  async pipeline(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT p.uuid AS pipelineUuid, p.name AS pipelineName, s.uuid AS stageUuid, s.code AS stageCode, s.name AS stageName, s.probability, COUNT(o.id) AS opportunities, COALESCE(SUM(o.value_amount), 0) AS totalValue, COALESCE(SUM(o.value_amount * s.probability / 100), 0) AS weightedValue FROM sales_opportunities o LEFT JOIN sales_pipelines p ON p.uuid = o.pipeline_uuid LEFT JOIN sales_pipeline_stages s ON s.uuid = o.stage_uuid WHERE ${this.range('o.created_at', query)} AND o.status = 'OPEN' AND ${this.salesScope(scope)} ${query.pipelineUuid ? Prisma.sql`AND p.uuid = ${query.pipelineUuid}` : Prisma.sql``} ${query.stageUuid ? Prisma.sql`AND s.uuid = ${query.stageUuid}` : Prisma.sql``} GROUP BY p.uuid, p.name, s.uuid, s.code, s.name, s.probability ORDER BY opportunities DESC LIMIT 5001`);
  }

  async stageVelocity(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT x.fromStageUuid AS stageUuid, COALESCE(AVG(TIMESTAMPDIFF(SECOND, x.occurredAt, x.nextOccurredAt)) / 86400, 0) AS averageDays, COUNT(*) AS transitions FROM (SELECT h.opportunity_uuid, h.from_stage_uuid AS fromStageUuid, h.occurred_at AS occurredAt, LEAD(h.occurred_at) OVER (PARTITION BY h.opportunity_uuid ORDER BY h.occurred_at, h.id) AS nextOccurredAt FROM sales_opportunity_stage_history h JOIN sales_opportunities o ON o.uuid = h.opportunity_uuid WHERE ${this.range('h.occurred_at', query)} AND ${this.salesScope(scope)}) x WHERE x.nextOccurredAt IS NOT NULL AND x.fromStageUuid IS NOT NULL GROUP BY x.fromStageUuid ORDER BY averageDays DESC LIMIT 5001`);
  }

  async opportunityAging(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT o.stage_uuid AS stageUuid, COUNT(*) AS count, COALESCE(AVG(DATEDIFF(${query.to}, o.created_at)), 0) AS averageAgeDays, MAX(DATEDIFF(${query.to}, o.created_at)) AS maxAgeDays FROM sales_opportunities o WHERE o.status = 'OPEN' AND o.created_at < ${query.to} AND ${this.salesScope(scope)} GROUP BY o.stage_uuid ORDER BY count DESC LIMIT 5001`);
  }

  async opportunityValue(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COALESCE(o.currency, 'UNKNOWN') AS currency, COUNT(*) AS opportunities, COALESCE(SUM(o.value_amount), 0) AS totalValue, COALESCE(AVG(o.value_amount), 0) AS averageValue FROM sales_opportunities o WHERE ${this.range('o.created_at', query)} AND ${this.salesScope(scope)} GROUP BY o.currency ORDER BY opportunities DESC`);
  }

  async propertyInventory(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT p.status, pt.code AS propertyType, pc.code AS propertyCategory, COUNT(*) AS count FROM properties p JOIN property_types pt ON pt.id = p.property_type_id JOIN property_categories pc ON pc.id = p.property_category_id WHERE ${this.range('p.created_at', query)} AND p.deleted_at IS NULL AND ${this.propertyScope(scope)} GROUP BY p.status, pt.code, pc.code ORDER BY count DESC LIMIT 5001`);
  }

  async listingAnalytics(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT l.transaction_type AS transactionType, l.status, l.visibility, l.featured, l.premium, COUNT(*) AS count FROM property_listings l JOIN properties p ON p.id = l.property_id WHERE ${this.range('l.created_at', query)} AND p.deleted_at IS NULL AND ${this.propertyScope(scope, 'p')} GROUP BY l.transaction_type, l.status, l.visibility, l.featured, l.premium ORDER BY count DESC LIMIT 5001`);
  }

  async propertyLifecycle(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COUNT(*) created, SUM(p.published_at IS NOT NULL) published, SUM(p.verified_at IS NOT NULL) verified, SUM(p.deleted_at IS NOT NULL) deleted, SUM(p.status = 'ARCHIVED') archived FROM properties p WHERE ${this.range('p.created_at', query)} AND ${this.propertyScope(scope)} `);
  }

  async propertyAging(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COALESCE(AVG(CASE WHEN p.published_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, p.created_at, p.published_at) / 86400 END), 0) AS averagePublishDays, COALESCE(AVG(CASE WHEN p.verified_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, p.created_at, p.verified_at) / 86400 END), 0) AS averageVerifyDays, COALESCE(AVG(CASE WHEN p.deleted_at IS NULL THEN DATEDIFF(${query.to}, p.created_at) END), 0) AS averageInactiveAgeDays FROM properties p WHERE p.created_at < ${query.to} AND ${this.propertyScope(scope)}`);
  }

  async agentWorkload(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT a.user_uuid AS agentUuid, a.display_name AS displayName, COALESCE((SELECT COUNT(*) FROM crm_leads l WHERE l.owner_user_uuid = a.user_uuid AND l.created_at >= ${query.from} AND l.created_at < ${query.to} AND l.archived_at IS NULL), 0) AS leads, COALESCE((SELECT COUNT(*) FROM sales_opportunities o WHERE o.owner_user_uuid = a.user_uuid AND o.created_at >= ${query.from} AND o.created_at < ${query.to}), 0) AS opportunities, COALESCE((SELECT COUNT(*) FROM property_agent_assignments pa JOIN properties p ON p.id = pa.property_id WHERE pa.agent_user_uuid = a.user_uuid AND pa.unassigned_at IS NULL AND p.deleted_at IS NULL), 0) AS properties, COALESCE((SELECT COUNT(*) FROM sales_activities sa WHERE sa.actor_user_uuid = a.user_uuid AND sa.created_at >= ${query.from} AND sa.created_at < ${query.to}), 0) AS activities FROM agent_profiles a WHERE a.deleted_at IS NULL AND ${scope.kind === 'global' ? Prisma.sql`1 = 1` : Prisma.sql`a.user_uuid = ${scope.userUuid}`} ORDER BY opportunities DESC LIMIT 5001`);
  }

  async agentActivity(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT sa.actor_user_uuid AS agentUuid, sa.type, sa.status, COUNT(*) AS count FROM sales_activities sa WHERE ${this.range('sa.created_at', query)} AND ${scope.kind === 'global' ? Prisma.sql`1 = 1` : Prisma.sql`sa.actor_user_uuid = ${scope.userUuid}`} GROUP BY sa.actor_user_uuid, sa.type, sa.status ORDER BY count DESC LIMIT 5001`);
  }

  async agentConversion(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT o.owner_user_uuid AS agentUuid, COUNT(*) AS opportunities, SUM(d.status = 'WON') AS wonDeals, COALESCE(SUM(CASE WHEN d.status = 'WON' THEN d.total_amount ELSE 0 END), 0) AS revenue FROM sales_opportunities o LEFT JOIN sales_deals d ON d.opportunity_uuid = o.uuid WHERE ${this.range('o.created_at', query)} AND ${this.salesScope(scope)} GROUP BY o.owner_user_uuid ORDER BY revenue DESC LIMIT 5001`);
  }

  async agentProperty(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT pa.agent_user_uuid AS agentUuid, COUNT(DISTINCT pa.property_id) AS activeProperties, COUNT(DISTINCT CASE WHEN p.published_at IS NOT NULL THEN pa.property_id END) AS publishedProperties FROM property_agent_assignments pa JOIN properties p ON p.id = pa.property_id WHERE pa.unassigned_at IS NULL AND p.deleted_at IS NULL AND ${this.propertyScope(scope, 'p')} GROUP BY pa.agent_user_uuid ORDER BY activeProperties DESC LIMIT 5001`);
  }

  async salesVolume(query: AnalyticsQuery, scope: AnalyticsScope) {
    const bucket = this.bucket('o.created_at', query);
    return this.raw(Prisma.sql`SELECT ${Prisma.raw(bucket)} AS period, o.status, COUNT(*) AS opportunities, SUM(o.status = 'WON') AS won, SUM(o.status = 'LOST') AS lost, COUNT(d.id) AS deals FROM sales_opportunities o LEFT JOIN sales_deals d ON d.opportunity_uuid = o.uuid WHERE ${this.range('o.created_at', query)} AND ${this.salesScope(scope)} GROUP BY ${Prisma.raw(bucket)}, o.status ORDER BY period ASC LIMIT 5001`);
  }

  async salesCycle(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COALESCE(AVG(CASE WHEN sc.closed_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, o.created_at, sc.closed_at) / 86400 END), 0) AS averageCloseDays, COALESCE(AVG(CASE WHEN o.status = 'WON' THEN TIMESTAMPDIFF(SECOND, o.created_at, o.updated_at) / 86400 END), 0) AS averageWonCycleDays, COUNT(o.id) AS opportunities FROM sales_opportunities o LEFT JOIN sales_deals d ON d.opportunity_uuid = o.uuid LEFT JOIN sales_closings sc ON sc.deal_uuid = d.uuid WHERE ${this.range('o.created_at', query)} AND ${this.salesScope(scope)}`);
  }

  async revenue(query: AnalyticsQuery, scope: AnalyticsScope) {
    const bucket = this.bucket('sc.closed_at', query);
    return this.raw(Prisma.sql`SELECT ${Prisma.raw(bucket)} AS period, COALESCE(d.currency, sc.currency) AS currency, COALESCE(SUM(d.total_amount), 0) AS closedRevenue, COUNT(d.id) AS deals FROM sales_closings sc JOIN sales_deals d ON d.uuid = sc.deal_uuid JOIN sales_opportunities o ON o.uuid = d.opportunity_uuid WHERE ${this.range('sc.closed_at', query)} AND sc.closed_at IS NOT NULL AND ${this.salesScope(scope, 'o')} GROUP BY ${Prisma.raw(bucket)}, COALESCE(d.currency, sc.currency) ORDER BY period ASC LIMIT 5001`);
  }

  async averageDeal(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COALESCE(d.currency, 'UNKNOWN') currency, COUNT(*) deals, COALESCE(AVG(d.total_amount), 0) averageValue, COALESCE(MIN(d.total_amount), 0) minValue, COALESCE(MAX(d.total_amount), 0) maxValue FROM sales_deals d JOIN sales_opportunities o ON o.uuid = d.opportunity_uuid WHERE ${this.range('d.created_at', query)} AND ${this.salesScope(scope, 'o')} GROUP BY d.currency`);
  }

  async sla(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COUNT(*) AS leads, SUM(l.qualified_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, l.created_at, l.qualified_at) <= 48) AS qualificationCompliant, SUM(l.qualified_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, l.created_at, l.qualified_at) > 48) AS qualificationBreached, COALESCE(AVG(CASE WHEN l.qualified_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, l.created_at, l.qualified_at) / 3600 END), 0) AS averageQualificationHours, COALESCE(AVG(CASE WHEN h.first_event_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, l.created_at, h.first_event_at) / 3600 END), 0) AS averageResponseHours FROM crm_leads l LEFT JOIN (SELECT lead_id, MIN(created_at) AS first_event_at FROM crm_lead_history GROUP BY lead_id) h ON h.lead_id = l.id WHERE ${this.range('l.created_at', query)} AND l.archived_at IS NULL AND ${this.crmScope(scope)}`);
  }

  async forecastInput(query: AnalyticsQuery, scope: AnalyticsScope) {
    return this.raw(Prisma.sql`SELECT COALESCE(SUM(CASE WHEN sc.closed_at IS NOT NULL THEN d.total_amount ELSE 0 END), 0) AS closedRevenue, COUNT(DISTINCT CASE WHEN sc.closed_at IS NOT NULL THEN d.id END) AS closedDeals, COALESCE(SUM(CASE WHEN o.status = 'OPEN' THEN o.value_amount * COALESCE(s.probability, 0) / 100 ELSE 0 END), 0) AS weightedPipeline, COUNT(DISTINCT CASE WHEN o.status = 'OPEN' THEN o.id END) AS openOpportunities FROM sales_opportunities o LEFT JOIN sales_pipeline_stages s ON s.uuid = o.stage_uuid LEFT JOIN sales_deals d ON d.opportunity_uuid = o.uuid LEFT JOIN sales_closings sc ON sc.deal_uuid = d.uuid WHERE o.created_at < ${query.to} AND ${this.salesScope(scope)}`);
  }
}
