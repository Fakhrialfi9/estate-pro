import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AUDIT_ACTIONS } from '../../../common/audit/audit-events.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../common/audit/security-audit.port.js';
import { SALES_REPOSITORY } from '../domain/repositories/sales.repository.js';
import type { SalesRepository } from '../domain/repositories/sales.repository.js';
import {
  dealTransitionAllowed,
  isUuid,
  negotiationTransitionAllowed,
  offerTransitionAllowed,
  parseMoney,
  transitionAllowed,
  viewingTransitionAllowed,
} from '../domain/sales.types.js';
import type {
  ActivityStatus,
  ActivityType,
  DealStatus,
  NegotiationStatus,
  OfferStatus,
  SalesActor,
  ViewingStatus,
} from '../domain/sales.types.js';

const hasPermission = (actor: SalesActor, permission: string): boolean =>
  actor.permissions.includes(permission) || actor.permissions.includes('sales.manage');

@Injectable()
export class SalesService {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repository: SalesRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  private require(actor: SalesActor, permission: string): void {
    if (!hasPermission(actor, permission)) throw new ForbiddenException();
  }

  private uuid(value: string): void {
    if (!isUuid(value)) throw new BadRequestException('Invalid UUID');
  }

  private async writeAudit(
    action: string,
    entityType: string,
    entityUuid: string | null,
    actor: SalesActor,
    reason?: string,
  ): Promise<void> {
    await this.audit.record({
      action,
      actorUuid: actor.actorUuid,
      userUuid: actor.actorUuid,
      actorType: 'AUTHENTICATED',
      entityType,
      entityUuid: entityUuid ?? undefined,
      requestId: actor.requestId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      result: 'SUCCESS',
      reason,
    });
  }

  private ensureOwner(actor: SalesActor, ownerUserUuid: string | null): void {
    if (hasPermission(actor, 'sales.manage')) return;
    if (ownerUserUuid !== actor.actorUuid) {
      throw new ForbiddenException('Sales record is outside your scope');
    }
  }

  async createPipeline(input: { name: string; description?: string; isActive?: boolean; sortOrder?: number }, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.create');
    if (!input.name.trim()) throw new BadRequestException('Pipeline name is required');
    const result = await this.repository.createPipeline(input);
    await this.writeAudit(AUDIT_ACTIONS.SALES_PIPELINE_CREATED, 'sales_pipeline', result.uuid, actor);
    return result;
  }

  async listPipelines(query: Record<string, unknown>, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.read');
    return this.repository.listPipelines(query);
  }

  async getPipeline(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.read');
    this.uuid(uuid);
    const result = await this.repository.getPipeline(uuid);
    if (!result) throw new NotFoundException('Pipeline not found');
    return result;
  }

  async updatePipeline(uuid: string, input: { name?: string; description?: string; isActive?: boolean; sortOrder?: number }, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.update');
    this.uuid(uuid);
    const result = await this.repository.updatePipeline(uuid, input);
    await this.writeAudit(AUDIT_ACTIONS.SALES_PIPELINE_UPDATED, 'sales_pipeline', uuid, actor);
    return result;
  }

  async archivePipeline(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.archive');
    this.uuid(uuid);
    const result = await this.repository.updatePipeline(uuid, { isActive: false });
    await this.writeAudit(AUDIT_ACTIONS.SALES_PIPELINE_ARCHIVED, 'sales_pipeline', uuid, actor);
    return result;
  }

  async createStage(input: { pipelineUuid: string; code: string; name: string; probability: number; isTerminal?: boolean; isActive?: boolean; sortOrder?: number }, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.stages.create');
    this.uuid(input.pipelineUuid);
    if (input.probability < 0 || input.probability > 100) throw new BadRequestException('Probability must be 0..100');
    const result = await this.repository.createStage(input);
    await this.writeAudit(AUDIT_ACTIONS.SALES_STAGE_CREATED, 'sales_pipeline_stage', result.uuid, actor);
    return result;
  }

  async listStages(pipelineUuid: string, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.read');
    this.uuid(pipelineUuid);
    return this.repository.listStages(pipelineUuid);
  }

  async updateStage(uuid: string, input: { code?: string; name?: string; probability?: number; isTerminal?: boolean; isActive?: boolean; sortOrder?: number }, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.stages.update');
    this.uuid(uuid);
    const result = await this.repository.updateStage(uuid, input);
    await this.writeAudit(AUDIT_ACTIONS.SALES_STAGE_UPDATED, 'sales_pipeline_stage', uuid, actor);
    return result;
  }

  async archiveStage(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.pipelines.stages.update');
    this.uuid(uuid);
    const result = await this.repository.updateStage(uuid, { isActive: false });
    await this.writeAudit(AUDIT_ACTIONS.SALES_STAGE_ARCHIVED, 'sales_pipeline_stage', uuid, actor);
    return result;
  }

  async reorderStages(pipelineUuid: string, ordered: string[], actor: SalesActor) {
    this.require(actor, 'sales.pipelines.stages.reorder');
    this.uuid(pipelineUuid);
    ordered.forEach((uuid) => this.uuid(uuid));
    const result = await this.repository.reorderStages(pipelineUuid, ordered);
    await this.writeAudit(AUDIT_ACTIONS.SALES_STAGES_REORDERED, 'sales_pipeline', pipelineUuid, actor);
    return result;
  }

  async createOpportunity(input: {
    leadUuid: string;
    contactUuid: string;
    ownerUserUuid?: string | null;
    teamUuid?: string | null;
    pipelineUuid?: string | null;
    stageUuid?: string | null;
    propertyUuid?: string | null;
    title: string;
    valueAmount?: string | null;
    currency?: string | null;
    idempotencyKey: string;
  }, actor: SalesActor) {
    this.require(actor, 'sales.opportunities.create');
    [input.leadUuid, input.contactUuid, input.ownerUserUuid, input.teamUuid, input.pipelineUuid, input.stageUuid, input.propertyUuid]
      .filter((value): value is string => typeof value === 'string')
      .forEach((value) => this.uuid(value));
    if (!input.title.trim()) throw new BadRequestException('Opportunity title is required');
    if (input.valueAmount !== null && input.valueAmount !== undefined) parseMoney(input.valueAmount);
    if (input.currency && !/^[A-Za-z]{3}$/.test(input.currency)) throw new BadRequestException('Currency must be ISO 4217');
    const result = await this.repository.createOpportunity(input);
    await this.writeAudit(AUDIT_ACTIONS.SALES_OPPORTUNITY_CREATED, 'sales_opportunity', result.uuid, actor);
    return result;
  }

  async getOpportunity(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.opportunities.read');
    this.uuid(uuid);
    const result = await this.repository.getOpportunity(uuid);
    if (!result) throw new NotFoundException('Opportunity not found');
    this.ensureOwner(actor, result.ownerUserUuid);
    return result;
  }

  async listOpportunities(query: Record<string, unknown>, actor: SalesActor) {
    this.require(actor, 'sales.opportunities.read');
    const scoped = { ...query };
    if (!hasPermission(actor, 'sales.manage')) scoped.ownerUserUuid = actor.actorUuid;
    return this.repository.listOpportunities(scoped);
  }

  async updateOpportunity(uuid: string, input: { version: number; title?: string; propertyUuid?: string | null; valueAmount?: string | null; currency?: string | null }, actor: SalesActor) {
    const result = await this.getOpportunity(uuid, actor);
    this.require(actor, 'sales.opportunities.update');
    if (input.propertyUuid) this.uuid(input.propertyUuid);
    if (input.valueAmount !== null && input.valueAmount !== undefined) parseMoney(input.valueAmount);
    const updated = await this.repository.updateOpportunity(uuid, input);
    await this.writeAudit(AUDIT_ACTIONS.SALES_OPPORTUNITY_UPDATED, 'sales_opportunity', result.uuid, actor);
    return updated;
  }

  async assignOpportunity(uuid: string, input: { ownerUserUuid?: string | null; teamUuid?: string | null }, actor: SalesActor) {
    this.require(actor, 'sales.opportunities.assign');
    this.uuid(uuid);
    if (input.ownerUserUuid) this.uuid(input.ownerUserUuid);
    if (input.teamUuid) this.uuid(input.teamUuid);
    const result = await this.repository.assignOpportunity(uuid, input.ownerUserUuid ?? null, input.teamUuid ?? null);
    await this.writeAudit(AUDIT_ACTIONS.SALES_OPPORTUNITY_ASSIGNED, 'sales_opportunity', uuid, actor);
    return result;
  }

  async transitionOpportunity(uuid: string, to: string, actor: SalesActor, reason?: string) {
    const current = await this.getOpportunity(uuid, actor);
    this.require(actor, 'sales.opportunities.transition');
    if (!transitionAllowed(current.status, to)) throw new ConflictException(`Invalid opportunity transition ${current.status} -> ${to}`);
    const result = await this.repository.transitionOpportunity(uuid, current.status, to as never, actor, reason);
    await this.writeAudit(AUDIT_ACTIONS.SALES_OPPORTUNITY_STATUS_CHANGED, 'sales_opportunity', uuid, actor, reason);
    return result;
  }

  async attachProperty(uuid: string, propertyUuid: string, actor: SalesActor) {
    const current = await this.getOpportunity(uuid, actor);
    this.require(actor, 'sales.opportunities.update');
    this.uuid(propertyUuid);
    const result = await this.repository.updateOpportunity(uuid, { version: current.version, propertyUuid });
    await this.writeAudit(AUDIT_ACTIONS.SALES_OPPORTUNITY_PROPERTY_ATTACHED, 'sales_opportunity', uuid, actor);
    return result;
  }

  async detachProperty(uuid: string, actor: SalesActor) {
    const current = await this.getOpportunity(uuid, actor);
    this.require(actor, 'sales.opportunities.update');
    const result = await this.repository.updateOpportunity(uuid, { version: current.version, propertyUuid: null });
    await this.writeAudit(AUDIT_ACTIONS.SALES_OPPORTUNITY_PROPERTY_DETACHED, 'sales_opportunity', uuid, actor);
    return result;
  }

  async stageHistory(uuid: string, query: Record<string, unknown>, actor: SalesActor) {
    await this.getOpportunity(uuid, actor);
    return this.repository.listStageHistory(uuid, query);
  }

  async createActivity(input: { opportunityUuid: string; type: ActivityType; subject: string; body?: string; dueAt?: string }, actor: SalesActor) {
    await this.getOpportunity(input.opportunityUuid, actor);
    this.require(actor, 'sales.activities.create');
    const result = await this.repository.createActivity({
      opportunityUuid: input.opportunityUuid,
      type: input.type,
      subject: input.subject,
      body: input.body,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    }, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_ACTIVITY_CREATED, 'sales_activity', result.uuid, actor);
    return result;
  }

  async activityStatus(uuid: string, status: ActivityStatus, actor: SalesActor) {
    this.require(actor, 'sales.activities.update');
    const result = await this.repository.updateActivityStatus(uuid, status, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_ACTIVITY_STATUS_CHANGED, 'sales_activity', uuid, actor);
    return result;
  }

  async listActivities(query: Record<string, unknown>, actor: SalesActor) {
    this.require(actor, 'sales.activities.read');
    if (query.opportunityUuid) await this.getOpportunity(String(query.opportunityUuid), actor);
    return this.repository.listActivities(query);
  }

  async createViewing(input: { opportunityUuid: string; propertyUuid: string; contactUuid: string; scheduledAt: string; notes?: string }, actor: SalesActor) {
    await this.getOpportunity(input.opportunityUuid, actor);
    this.require(actor, 'sales.viewings.create');
    this.uuid(input.propertyUuid);
    this.uuid(input.contactUuid);
    const scheduledAt = new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Viewing time must be current or future');
    }
    const result = await this.repository.createViewing({ ...input, scheduledAt }, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_VIEWING_CREATED, 'sales_viewing', result.uuid, actor);
    return result;
  }

  async viewingStatus(uuid: string, status: ViewingStatus, scheduledAt: string | undefined, actor: SalesActor) {
    this.require(actor, 'sales.viewings.update');
    const result = await this.repository.updateViewingStatus(uuid, status, scheduledAt ? new Date(scheduledAt) : null, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_VIEWING_STATUS_CHANGED, 'sales_viewing', uuid, actor);
    return result;
  }

  async listViewings(query: Record<string, unknown>, actor: SalesActor) {
    this.require(actor, 'sales.viewings.read');
    if (query.opportunityUuid) await this.getOpportunity(String(query.opportunityUuid), actor);
    return this.repository.listViewings(query);
  }

  async startNegotiation(input: { opportunityUuid: string; openedByUuid: string; notes?: string }, actor: SalesActor) {
    await this.getOpportunity(input.opportunityUuid, actor);
    this.require(actor, 'sales.negotiations.create');
    const result = await this.repository.createNegotiation(input, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_NEGOTIATION_CREATED, 'sales_negotiation', result.uuid, actor);
    return result;
  }

  async negotiationStatus(uuid: string, status: NegotiationStatus, actor: SalesActor) {
    this.require(actor, 'sales.negotiations.transition');
    const current = await this.repository.getNegotiation(uuid);
    if (!current) throw new NotFoundException('Negotiation not found');
    if (!negotiationTransitionAllowed(String(current.status), status)) throw new ConflictException('Invalid negotiation transition');
    const result = await this.repository.transitionNegotiation(uuid, status, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_NEGOTIATION_STATUS_CHANGED, 'sales_negotiation', uuid, actor);
    return result;
  }

  async negotiationHistory(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.negotiations.read');
    return this.repository.listNegotiationHistory(uuid);
  }

  async createOffer(input: { negotiationUuid: string; amount: string; currency: string; expiresAt?: string }, actor: SalesActor) {
    this.require(actor, 'sales.offers.create');
    parseMoney(input.amount);
    if (!/^[A-Za-z]{3}$/.test(input.currency)) throw new BadRequestException('Currency must be ISO 4217');
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) throw new BadRequestException('Offer expiry must be in the future');
    const result = await this.repository.createOffer({ ...input, expiresAt, actorUuid: actor.actorUuid });
    await this.writeAudit(AUDIT_ACTIONS.SALES_OFFER_CREATED, 'sales_offer', result.uuid, actor);
    return result;
  }

  async offerStatus(uuid: string, status: OfferStatus, actor: SalesActor) {
    this.require(actor, 'sales.offers.transition');
    const result = await this.repository.transitionOffer(uuid, status, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_OFFER_STATUS_CHANGED, 'sales_offer', uuid, actor);
    return result;
  }

  async offers(negotiationUuid: string, actor: SalesActor) {
    this.require(actor, 'sales.offers.read');
    return this.repository.listOffers(negotiationUuid);
  }

  async createDeal(input: { opportunityUuid: string; offerUuid?: string; idempotencyKey: string }, actor: SalesActor) {
    const opportunity = await this.getOpportunity(input.opportunityUuid, actor);
    this.require(actor, 'sales.deals.create');
    if (!input.offerUuid) throw new ConflictException('Accepted offer is required');
    this.uuid(input.offerUuid);
    const result = await this.repository.createDeal({ ...input, actorUuid: actor.actorUuid }, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_DEAL_CREATED, 'sales_deal', result.uuid, actor);
    void opportunity;
    return result;
  }

  async getDeal(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.deals.read');
    const deal = await this.repository.getDeal(uuid);
    if (!deal) throw new NotFoundException('Deal not found');
    this.ensureOwner(actor, (deal.ownerUserUuid as string | null) ?? null);
    return deal;
  }

  async listDeals(query: Record<string, unknown>, actor: SalesActor) {
    this.require(actor, 'sales.deals.read');
    const scoped = { ...query };
    if (!hasPermission(actor, 'sales.manage')) scoped.ownerUserUuid = actor.actorUuid;
    return this.repository.listDeals(scoped);
  }

  async addDealItem(dealUuid: string, input: { propertyUuid?: string; description: string; quantity: number; unitAmount: string; currency: string }, actor: SalesActor) {
    await this.getDeal(dealUuid, actor);
    this.require(actor, 'sales.deals.items.update');
    if (input.propertyUuid) this.uuid(input.propertyUuid);
    parseMoney(input.unitAmount);
    const result = await this.repository.addDealItem({ dealUuid, ...input }, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_DEAL_ITEM_CREATED, 'sales_deal', dealUuid, actor);
    return result;
  }

  async updateDealItem(uuid: string, input: { description?: string; quantity?: number; unitAmount?: string }, actor: SalesActor) {
    this.require(actor, 'sales.deals.items.update');
    if (input.unitAmount) parseMoney(input.unitAmount);
    const result = await this.repository.updateDealItem(uuid, input, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_DEAL_ITEM_UPDATED, 'sales_deal_item', uuid, actor);
    return result;
  }

  async removeDealItem(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.deals.items.update');
    await this.repository.removeDealItem(uuid, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_DEAL_ITEM_REMOVED, 'sales_deal_item', uuid, actor);
  }

  async dealStatus(uuid: string, status: DealStatus, actor: SalesActor) {
    this.require(actor, 'sales.deals.transition');
    const deal = await this.getDeal(uuid, actor);
    if (!dealTransitionAllowed(String(deal.status), status)) throw new ConflictException('Invalid deal transition');
    const result = await this.repository.transitionDeal(uuid, status, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_DEAL_STATUS_CHANGED, 'sales_deal', uuid, actor);
    return result;
  }

  async closeDeal(uuid: string, input: { method: string; closedAt: string; idempotencyKey: string }, actor: SalesActor) {
    this.require(actor, 'sales.closing.create');
    const deal = await this.getDeal(uuid, actor);
    if (deal.status === 'LOST' || deal.status === 'CANCELLED') throw new ConflictException('Terminal deal cannot close');
    const closedAt = new Date(input.closedAt);
    if (!Number.isFinite(closedAt.getTime())) throw new BadRequestException('Invalid closing date');
    const result = await this.repository.closeDeal(uuid, input.method, closedAt, actor, input.idempotencyKey);
    await this.writeAudit(AUDIT_ACTIONS.SALES_DEAL_CLOSED, 'sales_closing', result.uuid, actor);
    return result;
  }

  async lostOpportunity(uuid: string, reasonUuid: string, actor: SalesActor) {
    this.require(actor, 'sales.opportunities.lost');
    this.uuid(reasonUuid);
    const result = await this.repository.markLost('OPPORTUNITY', uuid, reasonUuid, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_OPPORTUNITY_LOST, 'sales_opportunity', uuid, actor, reasonUuid);
    return result;
  }

  async lostDeal(uuid: string, reasonUuid: string, actor: SalesActor) {
    this.require(actor, 'sales.deals.lost');
    this.uuid(reasonUuid);
    const result = await this.repository.markLost('DEAL', uuid, reasonUuid, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_DEAL_LOST, 'sales_deal', uuid, actor, reasonUuid);
    return result;
  }

  async reopenDeal(uuid: string, reason: string, actor: SalesActor) {
    this.require(actor, 'sales.deals.reopen');
    if (!reason.trim()) throw new BadRequestException('Reopen reason is required');
    return this.repository.reopenDeal(uuid, actor);
  }

  async lostReasons(actor: SalesActor) {
    this.require(actor, 'sales.lost-reasons.read');
    return this.repository.listLostReasons();
  }

  async createLostReason(input: { code: string; name: string; isActive?: boolean }, actor: SalesActor) {
    this.require(actor, 'sales.lost-reasons.manage');
    const result = await this.repository.createLostReason(input);
    await this.writeAudit(AUDIT_ACTIONS.SALES_LOST_REASON_CREATED, 'sales_lost_reason', result.uuid, actor);
    return result;
  }

  async updateLostReason(uuid: string, input: { name?: string; isActive?: boolean }, actor: SalesActor) {
    this.require(actor, 'sales.lost-reasons.manage');
    const result = await this.repository.updateLostReason(uuid, input);
    await this.writeAudit(AUDIT_ACTIONS.SALES_LOST_REASON_UPDATED, 'sales_lost_reason', uuid, actor);
    return result;
  }

  async createCommissionRule(input: { code: string; name: string; ratePercent: string; isActive?: boolean }, actor: SalesActor) {
    this.require(actor, 'sales.commission.rules.manage');
    parseMoney(input.ratePercent);
    const result = await this.repository.createCommissionRule(input);
    return result;
  }

  async calculateCommission(dealUuid: string, input: { ruleUuid: string; idempotencyKey: string }, actor: SalesActor) {
    this.require(actor, 'sales.commission.calculate');
    await this.getDeal(dealUuid, actor);
    this.uuid(input.ruleUuid);
    const result = await this.repository.calculateCommission(dealUuid, input.ruleUuid, actor, input.idempotencyKey);
    await this.writeAudit(AUDIT_ACTIONS.SALES_COMMISSION_CALCULATED, 'sales_commission', result.uuid, actor);
    return result;
  }

  async approveCommission(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.commission.approve');
    const result = await this.repository.approveCommission(uuid, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_COMMISSION_APPROVED, 'sales_commission', uuid, actor);
    return result;
  }

  async settleCommission(uuid: string, actor: SalesActor) {
    this.require(actor, 'sales.commission.settle');
    const result = await this.repository.settleCommission(uuid, actor);
    await this.writeAudit(AUDIT_ACTIONS.SALES_COMMISSION_SETTLED, 'sales_commission', uuid, actor);
    return result;
  }

  async commissionReport(query: Record<string, unknown>, actor: SalesActor) {
    this.require(actor, 'sales.commission.read');
    return this.repository.commissionReport(query);
  }

  async forecast(query: Record<string, unknown>, actor: SalesActor) {
    this.require(actor, 'sales.forecast.read');
    const scoped = { ...query };
    if (!hasPermission(actor, 'sales.manage')) scoped.ownerUserUuid = actor.actorUuid;
    return this.repository.forecast(scoped);
  }
}
