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

export interface SalesNegotiationRecord extends SalesRecord {
  readonly status: NegotiationStatus;
}

export interface SalesDealRecord extends SalesRecord {
  readonly status: DealStatus;
  readonly ownerUserUuid: string | null;
  readonly version: number;
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
  createPipeline(this: void, input: PipelineInput): Promise<SalesRecord>;
  listPipelines(
    this: void,
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  getPipeline(this: void, uuid: string): Promise<SalesRecord | null>;
  updatePipeline(
    this: void,
    uuid: string,
    input: Partial<PipelineInput>,
  ): Promise<SalesRecord>;
  createStage(this: void, input: StageInput): Promise<SalesRecord>;
  listStages(this: void, pipelineUuid: string): Promise<SalesRecord[]>;
  getStage(this: void, uuid: string): Promise<SalesRecord | null>;
  updateStage(
    this: void,
    uuid: string,
    input: Partial<Omit<StageInput, 'pipelineUuid'>>,
  ): Promise<SalesRecord>;
  reorderStages(
    this: void,
    pipelineUuid: string,
    orderedStageUuids: string[],
  ): Promise<SalesRecord[]>;
  createOpportunity(
    this: void,
    input: OpportunityInput,
  ): Promise<SalesOpportunityRow>;
  getOpportunity(this: void, uuid: string): Promise<SalesOpportunityRow | null>;
  listOpportunities(
    this: void,
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesOpportunityRow>>;
  updateOpportunity(
    this: void,
    uuid: string,
    input: Partial<OpportunityInput> & { version: number },
  ): Promise<SalesOpportunityRow>;
  transitionOpportunity(
    this: void,
    uuid: string,
    from: OpportunityStatus,
    to: OpportunityStatus,
    actor: SalesActor,
    reason?: string,
  ): Promise<SalesOpportunityRow>;
  assignOpportunity(
    this: void,
    uuid: string,
    ownerUserUuid: string | null,
    teamUuid: string | null,
    actor: SalesActor,
  ): Promise<SalesOpportunityRow>;
  listStageHistory(
    this: void,
    uuid: string,
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  createActivity(
    this: void,
    input: ActivityInput,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  updateActivityStatus(
    this: void,
    uuid: string,
    status: ActivityStatus,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  listActivities(
    this: void,
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  createViewing(
    this: void,
    input: ViewingInput,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  updateViewingStatus(
    this: void,
    uuid: string,
    status: ViewingStatus,
    scheduledAt: Date | null,
    actor?: SalesActor,
  ): Promise<SalesRecord | null>;
  listViewings(
    this: void,
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  createNegotiation(
    this: void,
    input: NegotiationInput,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  getNegotiation(
    this: void,
    uuid: string,
  ): Promise<SalesNegotiationRecord | null>;
  transitionNegotiation(
    this: void,
    uuid: string,
    status: NegotiationStatus,
    actor: SalesActor,
  ): Promise<SalesRecord | null>;
  listNegotiationHistory(
    this: void,
    uuid: string,
  ): Promise<SalesRecord[]>;
  createOffer(this: void, input: OfferInput): Promise<SalesRecord>;
  transitionOffer(
    this: void,
    uuid: string,
    status: OfferStatus,
    actor: SalesActor,
  ): Promise<SalesRecord | null>;
  listOffers(
    this: void,
    negotiationUuid: string,
  ): Promise<SalesRecord[]>;
  createDeal(
    this: void,
    input: DealInput,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  getDeal(this: void, uuid: string): Promise<SalesDealRecord | null>;
  listDeals(
    this: void,
    query: Record<string, unknown>,
  ): Promise<PageResult<SalesRecord>>;
  addDealItem(
    this: void,
    input: DealItemInput,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  updateDealItem(
    this: void,
    uuid: string,
    input: Partial<DealItemInput>,
    actor: SalesActor,
  ): Promise<SalesRecord>;
  removeDealItem(this: void, uuid: string, actor: SalesActor): Promise<void>;
  transitionDeal(
    this: void,
    uuid: string,
    status: DealStatus,
    actor: SalesActor,
  ): Promise<SalesRecord | null>;
  closeDeal(
    this: void,
    uuid: string,
    method: string,
    closedAt: Date,
    actor: SalesActor,
    idempotencyKey: string,
  ): Promise<SalesRecord>;
  markLost(
    this: void,
    targetType: 'OPPORTUNITY' | 'DEAL',
    uuid: string,
    reasonUuid: string,
    actor: SalesActor,
  ): Promise<SalesRecord | null>;
  reopenDeal(this: void, uuid: string, actor: SalesActor): void;
  listLostReasons(this: void): Promise<SalesRecord[]>;
  createLostReason(
    this: void,
    input: {
      code: string;
      name: string;
      isActive?: boolean;
    },
  ): Promise<SalesRecord>;
  updateLostReason(
    this: void,
    uuid: string,
    input: { name?: string; isActive?: boolean },
  ): Promise<SalesRecord>;
  createCommissionRule(
    this: void,
    input: {
      code: string;
      name: string;
      ratePercent: string;
      isActive?: boolean;
    },
  ): Promise<SalesRecord>;
  calculateCommission(
    this: void,
    dealUuid: string,
    ruleUuid: string,
    actor: SalesActor,
    idempotencyKey: string,
  ): Promise<SalesRecord>;
  approveCommission(this: void, uuid: string, actor: SalesActor): Promise<SalesRecord>;
  settleCommission(this: void, uuid: string, actor: SalesActor): Promise<SalesRecord>;
  commissionReport(
    this: void,
    query: Record<string, unknown>,
  ): Promise<SalesRecord>;
  forecast(
    this: void,
    query: Record<string, unknown>,
  ): Promise<SalesRecord>;
  findConversion(this: void, leadUuid: string): Promise<SalesOpportunityRow | null>;
}

export const SALES_REPOSITORY = Symbol('SALES_REPOSITORY');
