import type {
  ActivityStatus,
  ActivityType,
  DealStatus,
  NegotiationStatus,
  OfferStatus,
  OpportunityStatus,
  PageResult,
  SalesActor,
  ViewingStatus,
} from '../sales.types.js';

export interface SalesRecord {
  readonly uuid: string;
  readonly [key: string]: unknown;
}

export interface SalesOpportunityRow {
  uuid: string;
  leadUuid: string;
  contactUuid: string;
  ownerUserUuid: string | null;
  teamUuid: string | null;
  pipelineUuid: string | null;
  stageUuid: string | null;
  status: OpportunityStatus;
  propertyUuid: string | null;
  title: string;
  valueAmount: string | null;
  currency: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface StageInput {
  pipelineUuid: string;
  code: string;
  name: string;
  probability: number;
  isTerminal?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface OpportunityInput {
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
}

export interface ActivityInput {
  opportunityUuid: string;
  type: ActivityType;
  subject: string;
  body?: string | null;
  dueAt?: Date | null;
}

export interface ViewingInput {
  opportunityUuid: string;
  propertyUuid: string;
  contactUuid: string;
  scheduledAt: Date;
  notes?: string | null;
}

export interface NegotiationInput {
  opportunityUuid: string;
  openedByUuid: string;
  notes?: string | null;
}

export interface OfferInput {
  negotiationUuid: string;
  amount: string;
  currency: string;
  expiresAt?: Date | null;
  actorUuid: string;
}

export interface DealInput {
  opportunityUuid: string;
  offerUuid?: string | null;
  actorUuid: string;
  idempotencyKey: string;
}

export interface DealItemInput {
  dealUuid: string;
  propertyUuid?: string | null;
  description: string;
  quantity: number;
  unitAmount: string;
  currency: string;
}

export interface SalesRepository {
  createPipeline(input: PipelineInput): Promise<SalesRecord>;
  listPipelines(
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  getPipeline(uuid: string): Promise<SalesRecord | null>;
  updatePipeline(
    uuid: string,
    input: Partial<PipelineInput>,
  ): Promise<SalesRecord>;
  createStage(input: StageInput): Promise<SalesRecord>;
  listStages(pipelineUuid: string): Promise<SalesRecord[]>;
  getStage(uuid: string): Promise<SalesRecord | null>;
  updateStage(
    uuid: string,
    input: Partial<Omit<StageInput, 'pipelineUuid'>>,
  ): Promise<SalesRecord>;
  reorderStages(
    pipelineUuid: string,
    orderedStageUuids: string[],
  ): Promise<SalesRecord[]>;
  createOpportunity(input: OpportunityInput): Promise<SalesOpportunityRow>;
  getOpportunity(uuid: string): Promise<SalesOpportunityRow | null>;
  listOpportunities(
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesOpportunityRow>>;
  updateOpportunity(
    uuid: string,
    input: Partial<OpportunityInput> & { version: number },
  ): Promise<SalesOpportunityRow>;
  transitionOpportunity(
    uuid: string,
    from: OpportunityStatus,
    to: OpportunityStatus,
    actor: SalesActor,
    reason?: string,
  ): Promise<SalesOpportunityRow>;
  assignOpportunity(
    uuid: string,
    ownerUserUuid: string | null,
    teamUuid: string | null,
    actor: SalesActor,
  ): Promise<SalesOpportunityRow>;
  listStageHistory(
    uuid: string,
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  createActivity(input: ActivityInput, actor: SalesActor): Promise<SalesRecord>;
  updateActivityStatus(
    uuid: string,
    status: ActivityStatus,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  listActivities(
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  createViewing(input: ViewingInput, actor: SalesActor): Promise<SalesRecord>;
  updateViewingStatus(
    uuid: string,
    status: ViewingStatus,
    scheduledAt: Date | null,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  listViewings(
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  createNegotiation(
    input: NegotiationInput,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  getNegotiation(uuid: string): Promise<SalesRecord | null>;
  transitionNegotiation(
    uuid: string,
    status: NegotiationStatus,
    actor: SalesActor,
  ): Promise<SalesRecord | null>;
  listNegotiationHistory(uuid: string): Promise<SalesRecord[]>;
  createOffer(input: OfferInput): Promise<SalesRecord>;
  transitionOffer(
    uuid: string,
    status: OfferStatus,
    actor: SalesActor,
  ): Promise<SalesRecord | null>;
  listOffers(negotiationUuid: string): Promise<SalesRecord[]>;
  createDeal(input: DealInput, actor: SalesActor): Promise<SalesRecord>;
  getDeal(uuid: string): Promise<SalesRecord | null>;
  listDeals(query: Record<string, unknown>): Promise<PageResult<SalesRecord>>;
  addDealItem(input: DealItemInput, actor: SalesActor): Promise<SalesRecord>;
  updateDealItem(
    uuid: string,
    input: Partial<DealItemInput>,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  removeDealItem(uuid: string, actor: SalesActor): Promise<void>;
  transitionDeal(
    uuid: string,
    status: DealStatus,
    actor: SalesActor,
  ): Promise<SalesRecord | null>;
  closeDeal(
    uuid: string,
    method: string,
    closedAt: Date,
    actor: SalesActor,
    idempotencyKey: string,
  ): Promise<SalesRecord>;
  markLost(
    targetType: 'OPPORTUNITY' | 'DEAL',
    uuid: string,
    reasonUuid: string,
    actor: SalesActor,
  ): Promise<SalesRecord | null>;
  reopenDeal(uuid: string, actor: SalesActor): Promise<SalesRecord | null>;
  listLostReasons(): Promise<SalesRecord[]>;
  createLostReason(input: {
    code: string;
    name: string;
    isActive?: boolean;
  }): Promise<SalesRecord>;
  updateLostReason(
    uuid: string,
    input: { name?: string; isActive?: boolean },
  ): Promise<SalesRecord>;
  createCommissionRule(input: {
    code: string;
    name: string;
    ratePercent: string;
    isActive?: boolean;
  }): Promise<SalesRecord>;
  calculateCommission(
    dealUuid: string,
    ruleUuid: string,
    actor: SalesActor,
    idempotencyKey: string,
  ): Promise<SalesRecord>;
  approveCommission(uuid: string, actor: SalesActor): Promise<SalesRecord>;
  settleCommission(uuid: string, actor: SalesActor): Promise<SalesRecord>;
  commissionReport(query: Record<string, unknown>): Promise<SalesRecord>;
  forecast(query: Record<string, unknown>): Promise<SalesRecord>;
  findConversion(leadUuid: string): Promise<SalesOpportunityRow | null>;
}

export const SALES_REPOSITORY = Symbol('SALES_REPOSITORY');
