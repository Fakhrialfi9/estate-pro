import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  dealTransitionAllowed,
  negotiationTransitionAllowed,
  offerTransitionAllowed,
  viewingTransitionAllowed,
} from '../../domain/sales.types.js';
import type {
  ActivityInput,
  DealInput,
  DealItemInput,
  NegotiationInput,
  OfferInput,
  OpportunityInput,
  PipelineInput,
  SalesOpportunityRow,
  SalesRecord,
  SalesRepository,
  StageInput,
  ViewingInput,
} from '../../domain/repositories/sales.repository.js';
import type {
  ActivityStatus,
  DealStatus,
  NegotiationStatus,
  OfferStatus,
  OpportunityStatus,
  SalesActor,
  ViewingStatus,
} from '../../domain/sales.types.js';

const pageOf = (value: unknown, fallback = 1): number => {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? Math.min(100, Math.max(1, parsed)) : fallback;
};

const toOpportunity = (record: {
  uuid: string;
  leadUuid: string;
  contactUuid: string;
  ownerUserUuid: string | null;
  teamUuid: string | null;
  pipelineUuid: string | null;
  stageUuid: string | null;
  propertyUuid: string | null;
  title: string;
  valueAmount: unknown;
  currency: string | null;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): SalesOpportunityRow => ({
  ...record,
  valueAmount: record.valueAmount == null ? null : String(record.valueAmount),
  status: record.status as OpportunityStatus,
});

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

const lineTotal = (quantity: number, unitAmount: string): string => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ConflictException('Deal item quantity must be positive');
  }
  if (!/^\d+(?:\.\d{1,4})?$/.test(unitAmount)) {
    throw new ConflictException('Deal item amount must be a non-negative decimal');
  }
  const [whole, fraction = ''] = unitAmount.split('.');
  const scaled = BigInt(whole) * 10000n + BigInt((fraction + '0000').slice(0, 4));
  return ((scaled * BigInt(quantity)) / 1n / 10000n).toString() + '.' +
    ((scaled * BigInt(quantity)) % 10000n).toString().padStart(4, '0');
};

@Injectable()
export class PrismaSalesRepository implements SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPipeline(input: PipelineInput): Promise<SalesRecord> {
    try {
      return await this.prisma.salesPipeline.create({
        data: {
          uuid: randomUUID(),
          name: input.name.trim(),
          description: input.description ?? null,
          status: input.isActive === false ? 'ARCHIVED' : 'ACTIVE',
          sortOrder: input.sortOrder ?? 0,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Pipeline conflicts with existing data');
      }
      throw error;
    }
  }

  async listPipelines(query: Record<string, unknown>) {
    const page = pageOf(query.page);
    const limit = pageOf(query.limit, 20);
    const where = query.status ? { status: String(query.status) } : {};
    const [items, total] = await Promise.all([
      this.prisma.salesPipeline.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { stages: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.salesPipeline.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getPipeline(uuid: string) {
    return this.prisma.salesPipeline.findUnique({
      where: { uuid },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async updatePipeline(uuid: string, input: Partial<PipelineInput>) {
    try {
      return await this.prisma.salesPipeline.update({
        where: { uuid },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.isActive !== undefined
            ? { status: input.isActive ? 'ACTIVE' : 'ARCHIVED' }
            : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Pipeline conflicts with existing data');
      }
      throw error;
    }
  }

  async createStage(input: StageInput) {
    const pipeline = await this.prisma.salesPipeline.findUnique({
      where: { uuid: input.pipelineUuid },
      include: { stages: true },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    try {
      return await this.prisma.salesPipelineStage.create({
        data: {
          uuid: randomUUID(),
          pipelineUuid: input.pipelineUuid,
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          probability: input.probability,
          isTerminal: input.isTerminal ?? false,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? pipeline.stages.length + 1,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Stage code/order already exists');
      }
      throw error;
    }
  }

  async listStages(pipelineUuid: string) {
    return this.prisma.salesPipelineStage.findMany({
      where: { pipelineUuid },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getStage(uuid: string) {
    return this.prisma.salesPipelineStage.findUnique({ where: { uuid } });
  }

  async updateStage(
    uuid: string,
    input: Partial<Omit<StageInput, 'pipelineUuid'>>,
  ) {
    return this.prisma.salesPipelineStage.update({
      where: { uuid },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(input.isTerminal !== undefined ? { isTerminal: input.isTerminal } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  }

  async reorderStages(pipelineUuid: string, orderedStageUuids: string[]) {
    const current = await this.listStages(pipelineUuid);
    if (
      current.length !== orderedStageUuids.length ||
      new Set(orderedStageUuids).size !== orderedStageUuids.length ||
      orderedStageUuids.some((uuid) => !current.some((stage) => stage.uuid === uuid))
    ) {
      throw new ConflictException('Reorder set must exactly match pipeline stages');
    }

    return this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < orderedStageUuids.length; index += 1) {
        await tx.salesPipelineStage.update({
          where: { uuid: orderedStageUuids[index] },
          data: { sortOrder: -(index + 1) },
        });
      }
      for (let index = 0; index < orderedStageUuids.length; index += 1) {
        await tx.salesPipelineStage.update({
          where: { uuid: orderedStageUuids[index] },
          data: { sortOrder: index + 1 },
        });
      }
      return tx.salesPipelineStage.findMany({
        where: { pipelineUuid },
        orderBy: { sortOrder: 'asc' },
      });
    });
  }

  async createOpportunity(input: OpportunityInput) {
    try {
      const created = await this.prisma.salesOpportunity.create({
        data: {
          uuid: randomUUID(),
          leadUuid: input.leadUuid,
          contactUuid: input.contactUuid,
          ownerUserUuid: input.ownerUserUuid ?? null,
          teamUuid: input.teamUuid ?? null,
          pipelineUuid: input.pipelineUuid ?? null,
          stageUuid: input.stageUuid ?? null,
          propertyUuid: input.propertyUuid ?? null,
          title: input.title.trim(),
          valueAmount: input.valueAmount ?? null,
          currency: input.currency?.toUpperCase() ?? null,
          status: 'OPEN',
          version: 1,
          idempotencyKey: input.idempotencyKey,
        },
      });
      return toOpportunity(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.findConversion(input.leadUuid);
        if (existing) return existing;
        throw new ConflictException('Opportunity already exists for this command');
      }
      throw error;
    }
  }

  async findConversion(leadUuid: string) {
    const record = await this.prisma.salesOpportunity.findUnique({ where: { leadUuid } });
    return record ? toOpportunity(record) : null;
  }

  async getOpportunity(uuid: string) {
    const record = await this.prisma.salesOpportunity.findUnique({ where: { uuid } });
    return record ? toOpportunity(record) : null;
  }

  async listOpportunities(query: Record<string, unknown>) {
    const page = pageOf(query.page);
    const limit = pageOf(query.limit, 20);
    const where = {
      ...(query.ownerUserUuid ? { ownerUserUuid: String(query.ownerUserUuid) } : {}),
      ...(query.status ? { status: String(query.status) } : {}),
      ...(query.pipelineUuid ? { pipelineUuid: String(query.pipelineUuid) } : {}),
      ...(query.stageUuid ? { stageUuid: String(query.stageUuid) } : {}),
      ...(query.propertyUuid ? { propertyUuid: String(query.propertyUuid) } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.salesOpportunity.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { uuid: 'desc' }],
      }),
      this.prisma.salesOpportunity.count({ where }),
    ]);
    return { items: items.map(toOpportunity), total, page, limit };
  }

  async updateOpportunity(
    uuid: string,
    input: Partial<OpportunityInput> & { version: number },
  ) {
    const updated = await this.prisma.salesOpportunity.updateMany({
      where: {
        uuid,
        version: input.version,
        status: { notIn: ['WON', 'LOST', 'ARCHIVED'] },
      },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.propertyUuid !== undefined ? { propertyUuid: input.propertyUuid } : {}),
        ...(input.valueAmount !== undefined ? { valueAmount: input.valueAmount } : {}),
        ...(input.currency !== undefined ? { currency: input.currency?.toUpperCase() ?? null } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Opportunity is stale or terminal');
    }
    const result = await this.getOpportunity(uuid);
    if (!result) throw new NotFoundException('Opportunity not found');
    return result;
  }

  async assignOpportunity(
    uuid: string,
    ownerUserUuid: string | null,
    teamUuid: string | null,
  ) {
    const existing = await this.getOpportunity(uuid);
    if (!existing) throw new NotFoundException('Opportunity not found');
    return toOpportunity(
      await this.prisma.salesOpportunity.update({
        where: { uuid },
        data: {
          ownerUserUuid,
          teamUuid,
          version: { increment: 1 },
        },
      }),
    );
  }

  async transitionOpportunity(
    uuid: string,
    from: OpportunityStatus,
    to: OpportunityStatus,
    actor: SalesActor,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.salesOpportunity.findUnique({ where: { uuid } });
      if (!current) throw new NotFoundException('Opportunity not found');
      if (current.status !== from) throw new ConflictException('Opportunity changed concurrently');
      const updated = await tx.salesOpportunity.updateMany({
        where: { uuid, status: from, version: current.version },
        data: { status: to, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Opportunity changed concurrently');
      await tx.salesOpportunityStageHistory.create({
        data: {
          uuid: randomUUID(),
          opportunityUuid: uuid,
          fromStageUuid: current.stageUuid,
          toStageUuid: current.stageUuid,
          fromStatus: from,
          toStatus: to,
          actorUserUuid: actor.actorUuid,
          reason: reason ?? null,
        },
      });
      const result = await tx.salesOpportunity.findUnique({ where: { uuid } });
      if (!result) throw new NotFoundException('Opportunity not found');
      return toOpportunity(result);
    });
  }

  async listStageHistory(uuid: string, query: Record<string, unknown>) {
    const page = pageOf(query.page);
    const limit = pageOf(query.limit, 20);
    const where = { opportunityUuid: uuid };
    const [items, total] = await Promise.all([
      this.prisma.salesOpportunityStageHistory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }, { uuid: 'desc' }],
      }),
      this.prisma.salesOpportunityStageHistory.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async createActivity(input: ActivityInput, actor: SalesActor) {
    return this.prisma.salesActivity.create({
      data: {
        uuid: randomUUID(),
        opportunityUuid: input.opportunityUuid,
        actorUserUuid: actor.actorUuid,
        type: input.type,
        status: 'OPEN',
        subject: input.subject.trim(),
        body: input.body ?? null,
        dueAt: input.dueAt ?? null,
      },
    });
  }

  async updateActivityStatus(uuid: string, status: ActivityStatus) {
    const current = await this.prisma.salesActivity.findUnique({ where: { uuid } });
    if (!current) throw new NotFoundException('Activity not found');
    if (current.status !== 'OPEN' || !['COMPLETED', 'CANCELLED'].includes(status)) {
      throw new ConflictException('Activity lifecycle transition is invalid');
    }
    return this.prisma.salesActivity.update({
      where: { uuid },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });
  }

  async listActivities(query: Record<string, unknown>) {
    const page = pageOf(query.page);
    const limit = pageOf(query.limit, 20);
    const where = {
      ...(query.opportunityUuid ? { opportunityUuid: String(query.opportunityUuid) } : {}),
      ...(query.actorUserUuid ? { actorUserUuid: String(query.actorUserUuid) } : {}),
      ...(query.type ? { type: String(query.type) } : {}),
      ...(query.status ? { status: String(query.status) } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.salesActivity.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { uuid: 'desc' }],
      }),
      this.prisma.salesActivity.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async createViewing(input: ViewingInput, actor: SalesActor) {
    const conflict = await this.prisma.salesViewing.findFirst({
      where: {
        propertyUuid: input.propertyUuid,
        scheduledAt: input.scheduledAt,
        status: { in: ['REQUESTED', 'CONFIRMED'] },
      },
    });
    if (conflict) throw new ConflictException('Property already has a viewing at this time');
    return this.prisma.salesViewing.create({
      data: {
        uuid: randomUUID(),
        opportunityUuid: input.opportunityUuid,
        propertyUuid: input.propertyUuid,
        contactUuid: input.contactUuid,
        scheduledAt: input.scheduledAt,
        status: 'REQUESTED',
        notes: input.notes ?? null,
        actorUserUuid: actor.actorUuid,
      },
    });
  }

  async updateViewingStatus(
    uuid: string,
    status: ViewingStatus,
    scheduledAt: Date | null,
  ) {
    const current = await this.prisma.salesViewing.findUnique({ where: { uuid } });
    if (!current) throw new NotFoundException('Viewing not found');
    if (!viewingTransitionAllowed(current.status, status)) {
      throw new ConflictException('Viewing lifecycle transition is invalid');
    }
    if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) {
      throw new ConflictException('Viewing schedule cannot be in the past');
    }
    return this.prisma.salesViewing.update({
      where: { uuid },
      data: { status, ...(scheduledAt ? { scheduledAt } : {}) },
    });
  }

  async listViewings(query: Record<string, unknown>) {
    const page = pageOf(query.page);
    const limit = pageOf(query.limit, 20);
    const where = {
      ...(query.opportunityUuid ? { opportunityUuid: String(query.opportunityUuid) } : {}),
      ...(query.propertyUuid ? { propertyUuid: String(query.propertyUuid) } : {}),
      ...(query.status ? { status: String(query.status) } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.salesViewing.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ scheduledAt: 'asc' }, { uuid: 'asc' }],
      }),
      this.prisma.salesViewing.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async createNegotiation(input: NegotiationInput) {
    return this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.salesOpportunity.findUnique({
        where: { uuid: input.opportunityUuid },
      });
      if (!opportunity) throw new NotFoundException('Opportunity not found');
      if (!['QUALIFIED', 'NEGOTIATING'].includes(opportunity.status)) {
        throw new ConflictException('Opportunity is not ready for negotiation');
      }
      const negotiation = await tx.salesNegotiation.create({
        data: {
          uuid: randomUUID(),
          opportunityUuid: input.opportunityUuid,
          openedByUuid: input.openedByUuid,
          status: 'OPEN',
          notes: input.notes ?? null,
        },
      });
      if (opportunity.status === 'QUALIFIED') {
        await tx.salesOpportunity.updateMany({
          where: { uuid: opportunity.uuid, status: 'QUALIFIED', version: opportunity.version },
          data: { status: 'NEGOTIATING', version: { increment: 1 } },
        });
      }
      return negotiation;
    });
  }

  async getNegotiation(uuid: string) {
    return this.prisma.salesNegotiation.findUnique({ where: { uuid } });
  }

  async transitionNegotiation(uuid: string, status: NegotiationStatus, actor: SalesActor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.salesNegotiation.findUnique({ where: { uuid } });
      if (!current) throw new NotFoundException('Negotiation not found');
      if (!negotiationTransitionAllowed(current.status, status)) {
        throw new ConflictException('Negotiation lifecycle transition is invalid');
      }
      const updated = await tx.salesNegotiation.updateMany({
        where: { uuid, status: current.status, version: current.version },
        data: { status, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Negotiation changed concurrently');
      await tx.salesNegotiationHistory.create({
        data: {
          uuid: randomUUID(),
          negotiationUuid: uuid,
          fromStatus: current.status,
          toStatus: status,
          actorUserUuid: actor.actorUuid,
        },
      });
      return tx.salesNegotiation.findUnique({ where: { uuid } });
    });
  }

  async listNegotiationHistory(uuid: string) {
    return this.prisma.salesNegotiationHistory.findMany({
      where: { negotiationUuid: uuid },
      orderBy: [{ occurredAt: 'asc' }, { uuid: 'asc' }],
    });
  }

  async createOffer(input: OfferInput) {
    const negotiation = await this.getNegotiation(input.negotiationUuid);
    if (!negotiation) throw new NotFoundException('Negotiation not found');
    const latest = await this.prisma.salesOffer.findFirst({
      where: { negotiationUuid: input.negotiationUuid },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;
    return this.prisma.salesOffer.create({
      data: {
        uuid: randomUUID(),
        negotiationUuid: input.negotiationUuid,
        version,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        status: 'DRAFT',
        expiresAt: input.expiresAt ?? null,
        actorUserUuid: input.actorUuid,
      },
    });
  }

  async transitionOffer(uuid: string, status: OfferStatus) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.salesOffer.findUnique({ where: { uuid } });
      if (!current) throw new NotFoundException('Offer not found');
      if (!offerTransitionAllowed(current.status, status)) {
        throw new ConflictException('Offer lifecycle transition is invalid');
      }
      const updated = await tx.salesOffer.updateMany({
        where: { uuid, status: current.status },
        data: { status },
      });
      if (updated.count !== 1) throw new ConflictException('Offer changed concurrently');
      return tx.salesOffer.findUnique({ where: { uuid } });
    });
  }

  async listOffers(negotiationUuid: string) {
    return this.prisma.salesOffer.findMany({
      where: { negotiationUuid },
      orderBy: [{ version: 'desc' }, { uuid: 'desc' }],
    });
  }

  async createDeal(input: DealInput) {
    return this.prisma.$transaction(async (tx) => {
      const existingByKey = await tx.salesDeal.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existingByKey) return existingByKey;

      const opportunity = await tx.salesOpportunity.findUnique({
        where: { uuid: input.opportunityUuid },
      });
      if (!opportunity) throw new NotFoundException('Opportunity not found');
      if (!['QUALIFIED', 'NEGOTIATING'].includes(opportunity.status)) {
        throw new ConflictException('Opportunity is not eligible for deal conversion');
      }
      if (!input.offerUuid) throw new ConflictException('Accepted offer is required');
      const offer = await tx.salesOffer.findUnique({ where: { uuid: input.offerUuid } });
      if (!offer || offer.status !== 'ACCEPTED') throw new ConflictException('Accepted offer is required');
      if (offer.negotiationUuid) {
        const negotiation = await tx.salesNegotiation.findUnique({ where: { uuid: offer.negotiationUuid } });
        if (!negotiation || negotiation.opportunityUuid !== opportunity.uuid) {
          throw new ConflictException('Offer does not belong to opportunity');
        }
      }

      const deal = await tx.salesDeal.create({
        data: {
          uuid: randomUUID(),
          opportunityUuid: opportunity.uuid,
          offerUuid: offer.uuid,
          status: 'OPEN',
          ownerUserUuid: opportunity.ownerUserUuid,
          currency: offer.currency,
          totalAmount: offer.amount,
          version: 1,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.salesOpportunity.updateMany({
        where: { uuid: opportunity.uuid, status: opportunity.status, version: opportunity.version },
        data: { status: 'WON', version: { increment: 1 } },
      });
      return deal;
    });
  }

  async getDeal(uuid: string) {
    return this.prisma.salesDeal.findUnique({
      where: { uuid },
      include: { items: true, closing: true, commission: true },
    });
  }

  async listDeals(query: Record<string, unknown>) {
    const page = pageOf(query.page);
    const limit = pageOf(query.limit, 20);
    const where = {
      ...(query.ownerUserUuid ? { ownerUserUuid: String(query.ownerUserUuid) } : {}),
      ...(query.status ? { status: String(query.status) } : {}),
      ...(query.propertyUuid
        ? { opportunity: { propertyUuid: String(query.propertyUuid) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.salesDeal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { uuid: 'desc' }],
        include: { items: true },
      }),
      this.prisma.salesDeal.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  private async recalculateDealTotal(dealUuid: string, tx: PrismaService | undefined = undefined) {
    const client = tx ?? this.prisma;
    const items = await client.salesDealItem.findMany({ where: { dealUuid } });
    if (items.length === 0) return;
    const totalScaled = items.reduce((sum, item) => {
      const text = String(item.lineAmount);
      const [whole, fraction = ''] = text.split('.');
      return sum + BigInt(whole) * 10000n + BigInt((fraction + '0000').slice(0, 4));
    }, 0n);
    const total = `${totalScaled / 10000n}.${(totalScaled % 10000n).toString().padStart(4, '0')}`;
    await client.salesDeal.update({ where: { uuid: dealUuid }, data: { totalAmount: total } });
  }

  async addDealItem(input: DealItemInput) {
    const deal = await this.getDeal(input.dealUuid);
    if (!deal) throw new NotFoundException('Deal not found');
    if (['CLOSED', 'LOST', 'CANCELLED'].includes(String(deal.status))) {
      throw new ConflictException('Terminal deal cannot be edited');
    }
    const lineAmount = lineTotal(input.quantity, input.unitAmount);
    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.salesDealItem.create({
        data: {
          uuid: randomUUID(),
          dealUuid: input.dealUuid,
          propertyUuid: input.propertyUuid ?? null,
          description: input.description.trim(),
          quantity: input.quantity,
          unitAmount: input.unitAmount,
          lineAmount,
          currency: input.currency.toUpperCase(),
        },
      });
      await this.recalculateDealTotal(input.dealUuid, tx as unknown as PrismaService);
      return item;
    });
    return result;
  }

  async updateDealItem(uuid: string, input: Partial<DealItemInput>) {
    const current = await this.prisma.salesDealItem.findUnique({ where: { uuid } });
    if (!current) throw new NotFoundException('Deal item not found');
    const deal = await this.getDeal(current.dealUuid);
    if (!deal) throw new NotFoundException('Deal not found');
    if (['CLOSED', 'LOST', 'CANCELLED'].includes(String(deal.status))) {
      throw new ConflictException('Terminal deal cannot be edited');
    }
    const quantity = input.quantity ?? current.quantity;
    const unitAmount = input.unitAmount ?? String(current.unitAmount);
    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.salesDealItem.update({
        where: { uuid },
        data: {
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          quantity,
          unitAmount,
          lineAmount: lineTotal(quantity, unitAmount),
        },
      });
      await this.recalculateDealTotal(current.dealUuid, tx as unknown as PrismaService);
      return item;
    });
    return result;
  }

  async removeDealItem(uuid: string) {
    const current = await this.prisma.salesDealItem.findUnique({ where: { uuid } });
    if (!current) throw new NotFoundException('Deal item not found');
    const deal = await this.getDeal(current.dealUuid);
    if (!deal) throw new NotFoundException('Deal not found');
    if (['CLOSED', 'LOST', 'CANCELLED'].includes(String(deal.status))) {
      throw new ConflictException('Terminal deal cannot be edited');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.salesDealItem.delete({ where: { uuid } });
      await this.recalculateDealTotal(current.dealUuid, tx as unknown as PrismaService);
    });
  }

  async transitionDeal(uuid: string, status: DealStatus) {
    const current = await this.getDeal(uuid);
    if (!current) throw new NotFoundException('Deal not found');
    if (!dealTransitionAllowed(String(current.status), status)) {
      throw new ConflictException('Deal lifecycle transition is invalid');
    }
    const result = await this.prisma.salesDeal.updateMany({
      where: { uuid, status: current.status, version: current.version },
      data: { status, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new ConflictException('Deal changed concurrently');
    return this.getDeal(uuid);
  }

  async closeDeal(
    uuid: string,
    method: string,
    closedAt: Date,
    actor: SalesActor,
    idempotencyKey: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existingByKey = await tx.salesClosing.findUnique({ where: { idempotencyKey } });
      if (existingByKey) return existingByKey;
      const deal = await tx.salesDeal.findUnique({ where: { uuid } });
      if (!deal) throw new NotFoundException('Deal not found');
      if (!['OPEN', 'IN_PROGRESS', 'READY_TO_CLOSE'].includes(deal.status)) {
        throw new ConflictException('Deal cannot be closed from current state');
      }
      if (closedAt.getTime() > Date.now() + 60_000) {
        throw new ConflictException('Closing date cannot be in the future');
      }
      const updated = await tx.salesDeal.updateMany({
        where: { uuid, status: deal.status, version: deal.version },
        data: { status: 'CLOSED', version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Deal changed concurrently');
      return tx.salesClosing.create({
        data: {
          uuid: randomUUID(),
          dealUuid: uuid,
          method: method.trim(),
          closedAt,
          actorUserUuid: actor.actorUuid,
          idempotencyKey,
        },
      });
    });
  }

  async markLost(
    targetType: 'OPPORTUNITY' | 'DEAL',
    uuid: string,
    reasonUuid: string,
  ) {
    const reason = await this.prisma.salesLostReason.findUnique({ where: { uuid: reasonUuid } });
    if (!reason || !reason.isActive) throw new ConflictException('Active lost reason is required');
    if (targetType === 'OPPORTUNITY') {
      const current = await this.getOpportunity(uuid);
      if (!current) throw new NotFoundException('Opportunity not found');
      return this.transitionOpportunity(uuid, current.status, 'LOST', {
        actorUuid: '',
        permissions: [],
      }, reasonUuid);
    }
    const deal = await this.getDeal(uuid);
    if (!deal) throw new NotFoundException('Deal not found');
    const updated = await this.prisma.salesDeal.updateMany({
      where: { uuid, status: deal.status, version: deal.version },
      data: { status: 'LOST', version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ConflictException('Deal changed concurrently');
    return this.getDeal(uuid);
  }

  async reopenDeal() {
    throw new ConflictException('Terminal deals are immutable and cannot be reopened');
  }

  async listLostReasons() {
    return this.prisma.salesLostReason.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createLostReason(input: { code: string; name: string; isActive?: boolean }) {
    return this.prisma.salesLostReason.create({
      data: {
        uuid: randomUUID(),
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateLostReason(uuid: string, input: { name?: string; isActive?: boolean }) {
    return this.prisma.salesLostReason.update({
      where: { uuid },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async createCommissionRule(input: { code: string; name: string; ratePercent: string; isActive?: boolean }) {
    return this.prisma.salesCommissionRule.create({
      data: {
        uuid: randomUUID(),
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        ratePercent: input.ratePercent,
        isActive: input.isActive ?? true,
      },
    });
  }

  async calculateCommission(
    dealUuid: string,
    ruleUuid: string,
    actor: SalesActor,
    idempotencyKey: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.salesCommission.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
      const deal = await tx.salesDeal.findUnique({ where: { uuid: dealUuid } });
      if (!deal || deal.status !== 'CLOSED') throw new ConflictException('Closed deal is required');
      const rule = await tx.salesCommissionRule.findUnique({ where: { uuid: ruleUuid } });
      if (!rule || !rule.isActive) throw new ConflictException('Active commission rule is required');
      const base = String(deal.totalAmount ?? '0');
      const [whole, fraction = ''] = base.split('.');
      const baseScaled = BigInt(whole) * 10000n + BigInt((fraction + '0000').slice(0, 4));
      const rateText = String(rule.ratePercent);
      const [rateWhole, rateFraction = ''] = rateText.split('.');
      const rateScaled = BigInt(rateWhole) * 10000n + BigInt((rateFraction + '0000').slice(0, 4));
      const amountScaled = (baseScaled * rateScaled) / 1000000n;
      const amount = `${amountScaled / 10000n}.${(amountScaled % 10000n).toString().padStart(4, '0')}`;
      return tx.salesCommission.create({
        data: {
          uuid: randomUUID(),
          dealUuid,
          ruleUuid,
          baseAmount: base,
          ratePercent: rule.ratePercent,
          amount,
          currency: deal.currency ?? 'USD',
          status: 'PENDING',
          idempotencyKey,
        },
      });
    });
  }

  async approveCommission(uuid: string) {
    const current = await this.prisma.salesCommission.findUnique({ where: { uuid } });
    if (!current) throw new NotFoundException('Commission not found');
    if (current.status !== 'PENDING') throw new ConflictException('Commission must be pending');
    return this.prisma.salesCommission.update({
      where: { uuid },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
  }

  async settleCommission(uuid: string) {
    const current = await this.prisma.salesCommission.findUnique({ where: { uuid } });
    if (!current) throw new NotFoundException('Commission not found');
    if (current.status !== 'APPROVED') throw new ConflictException('Commission must be approved');
    return this.prisma.salesCommission.update({
      where: { uuid },
      data: { status: 'SETTLED', settledAt: new Date() },
    });
  }

  async commissionReport(query: Record<string, unknown>) {
    const where = query.status ? { status: String(query.status) } : {};
    const rows = await this.prisma.salesCommission.findMany({ where, orderBy: { calculatedAt: 'desc' } });
    const totalScaled = rows.reduce((sum, row) => {
      const text = String(row.amount);
      const [whole, fraction = ''] = text.split('.');
      return sum + BigInt(whole) * 10000n + BigInt((fraction + '0000').slice(0, 4));
    }, 0n);
    return {
      status: query.status ?? 'ALL',
      count: rows.length,
      total: `${totalScaled / 10000n}.${(totalScaled % 10000n).toString().padStart(4, '0')}`,
      items: rows,
    };
  }

  async forecast(query: Record<string, unknown>) {
    const where = {
      ...(query.ownerUserUuid ? { ownerUserUuid: String(query.ownerUserUuid) } : {}),
      status: { in: ['OPEN', 'QUALIFIED', 'NEGOTIATING'] },
    };
    const rows = await this.prisma.salesOpportunity.findMany({
      where,
      include: { stage: true },
      orderBy: [{ createdAt: 'desc' }, { uuid: 'desc' }],
    });
    let pipelineScaled = 0n;
    let weightedScaled = 0n;
    for (const row of rows) {
      const text = String(row.valueAmount ?? '0');
      const [whole, fraction = ''] = text.split('.');
      const amountScaled = BigInt(whole) * 10000n + BigInt((fraction + '0000').slice(0, 4));
      const probability = BigInt(row.stage?.probability ?? 0);
      pipelineScaled += amountScaled;
      weightedScaled += (amountScaled * probability) / 100n;
    }
    return {
      currency: 'MIXED',
      opportunities: rows.length,
      pipelineValue: `${pipelineScaled / 10000n}.${(pipelineScaled % 10000n).toString().padStart(4, '0')}`,
      weightedForecast: `${weightedScaled / 10000n}.${(weightedScaled % 10000n).toString().padStart(4, '0')}`,
      asOf: new Date().toISOString(),
    };
  }
}
