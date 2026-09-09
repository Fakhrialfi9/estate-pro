import type { SeedTransaction } from './database.ts';
import { SEED_REFERENCE_DATE, seedUuid } from './shared/ids.ts';

const AGENT_USER_UUIDS = [
  '00000000-0000-5000-8000-000000000002',
  '00000000-0000-5000-8000-000000000003',
  '00000000-0000-5000-8000-000000000004',
  '00000000-0000-5000-8000-000000000005',
  '00000000-0000-5000-8000-000000000006',
  '00000000-0000-5000-8000-000000000007',
  '00000000-0000-5000-8000-000000000008',
  '00000000-0000-5000-8000-000000000009',
  '00000000-0000-5000-8000-00000000000a',
  '00000000-0000-5000-8000-00000000000b',
] as const;

const stagePlan = [
  'WON', 'WON', 'WON', 'WON', 'WON', 'WON', 'WON', 'WON', 'WON', 'WON',
  'LOST', 'LOST', 'LOST', 'LOST',
  'QUALIFIED', 'QUALIFIED', 'QUALIFIED',
  'NEGOTIATING', 'NEGOTIATING',
  'OPEN',
] as const;

const SEED_LEAD_CODES = Array.from({ length: 20 }, (_, index) => `LEAD-SEED-${String(index + 1).padStart(3, '0')}`);

function dateOffset(days: number, hours = 10): Date {
  const value = new Date(SEED_REFERENCE_DATE.getTime());
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hours, 0, 0, 0);
  return value;
}

export async function seedSalesCompletionSafe(tx: SeedTransaction): Promise<void> {
  const pipeline = await tx.salesPipeline.findFirstOrThrow({ orderBy: { id: 'asc' } });
  const stages = await tx.salesPipelineStage.findMany({
    where: { pipelineUuid: pipeline.uuid },
    orderBy: { sortOrder: 'asc' },
  });
  const stageByCode = new Map(stages.map((stage) => [stage.code, stage]));
  const leads = await tx.crmLead.findMany({
    where: { code: { in: SEED_LEAD_CODES } },
    orderBy: { code: 'asc' },
    take: SEED_LEAD_CODES.length,
    select: { uuid: true },
  });
  const contacts = await tx.crmContact.findMany({ orderBy: { id: 'asc' }, take: 20, select: { uuid: true } });
  const properties = await tx.property.findMany({ orderBy: { id: 'asc' }, take: 20, select: { uuid: true } });
  const lostReasons = await tx.salesLostReason.findMany({ orderBy: { id: 'asc' } });
  const commissionRule = await tx.salesCommissionRule.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' } });

  if (leads.length < 20 || contacts.length < 20 || properties.length < 20 || lostReasons.length === 0) {
    throw new Error('Sales completion fixtures require 20 leads, contacts and properties plus a lost reason');
  }

  for (let index = 0; index < stagePlan.length; index += 1) {
    const lead = leads[index];
    const contact = contacts[index];
    const property = properties[index];
    const stageCode = stagePlan[index];
    if (!lead || !contact || !property || !stageCode) throw new Error(`Missing sales completion dependency at ${index}`);

    const stage = stageByCode.get(stageCode);
    if (!stage) throw new Error(`Missing required sales pipeline stage ${stageCode}`);

    const ownerUserUuid = AGENT_USER_UUIDS[index % AGENT_USER_UUIDS.length];
    const amount = 2_000_000_000 + index * 175_000_000;
    const opportunity = await tx.salesOpportunity.upsert({
      where: { leadUuid: lead.uuid },
      update: {
        contactUuid: contact.uuid,
        ownerUserUuid,
        pipelineUuid: pipeline.uuid,
        stageUuid: stage.uuid,
        propertyUuid: property.uuid,
        lostReasonUuid: stageCode === 'LOST' ? lostReasons[index % lostReasons.length]?.uuid : null,
        title: `Property Opportunity ${index + 1}`,
        valueAmount: String(amount),
        currency: 'IDR',
        status: stageCode === 'WON' ? 'WON' : stageCode === 'LOST' ? 'LOST' : 'OPEN',
        version: 1,
        idempotencyKey: `seed-sales-completion-${index + 1}`,
      },
      create: {
        uuid: seedUuid('sales-opportunity-completion', String(index + 1)),
        leadUuid: lead.uuid,
        contactUuid: contact.uuid,
        ownerUserUuid,
        pipelineUuid: pipeline.uuid,
        stageUuid: stage.uuid,
        propertyUuid: property.uuid,
        lostReasonUuid: stageCode === 'LOST' ? lostReasons[index % lostReasons.length]?.uuid : null,
        title: `Property Opportunity ${index + 1}`,
        valueAmount: String(amount),
        currency: 'IDR',
        status: stageCode === 'WON' ? 'WON' : stageCode === 'LOST' ? 'LOST' : 'OPEN',
        version: 1,
        idempotencyKey: `seed-sales-completion-${index + 1}`,
      },
    });

    await tx.salesOpportunityStageHistory.deleteMany({ where: { opportunityUuid: opportunity.uuid } });
    await tx.salesOpportunityStageHistory.create({
      data: {
        uuid: seedUuid('sales-opportunity-stage-completion', String(index + 1)),
        opportunityUuid: opportunity.uuid,
        fromStageUuid: stageCode === 'OPEN' ? null : stageByCode.get('OPEN')?.uuid,
        toStageUuid: stage.uuid,
        fromStatus: 'OPEN',
        toStatus: opportunity.status,
        actorUserUuid: ownerUserUuid,
        reason: `Deterministic seed transition to ${stageCode}.`,
        occurredAt: dateOffset(index - 20),
      },
    });

    const negotiationStatus = stageCode === 'WON' ? 'CLOSED' : stageCode === 'LOST' ? 'CANCELLED' : 'OPEN';
    const negotiation = await tx.salesNegotiation.upsert({
      where: { uuid: seedUuid('sales-negotiation-completion', String(index + 1)) },
      update: { opportunityUuid: opportunity.uuid, openedByUuid: ownerUserUuid, status: negotiationStatus, notes: `Negotiation scenario ${index + 1}.`, version: 1 },
      create: { uuid: seedUuid('sales-negotiation-completion', String(index + 1)), opportunityUuid: opportunity.uuid, openedByUuid: ownerUserUuid, status: negotiationStatus, notes: `Negotiation scenario ${index + 1}.`, version: 1 },
    });

    await tx.salesNegotiationHistory.deleteMany({ where: { negotiationUuid: negotiation.uuid } });
    await tx.salesNegotiationHistory.create({
      data: {
        uuid: seedUuid('sales-negotiation-history-completion', String(index + 1)),
        negotiationUuid: negotiation.uuid,
        fromStatus: 'OPEN',
        toStatus: negotiationStatus,
        actorUserUuid: ownerUserUuid,
        occurredAt: dateOffset(index - 18),
      },
    });

    const offerStatus = stageCode === 'WON' ? 'ACCEPTED' : stageCode === 'LOST' ? 'REJECTED' : 'DRAFT';
    const offer = await tx.salesOffer.upsert({
      where: { negotiationUuid_version: { negotiationUuid: negotiation.uuid, version: 1 } },
      update: { amount: String(amount - 75_000_000), currency: 'IDR', status: offerStatus, expiresAt: dateOffset(index + 15), actorUserUuid: ownerUserUuid },
      create: { uuid: seedUuid('sales-offer-completion', String(index + 1)), negotiationUuid: negotiation.uuid, version: 1, amount: String(amount - 75_000_000), currency: 'IDR', status: offerStatus, expiresAt: dateOffset(index + 15), actorUserUuid: ownerUserUuid },
    });

    await tx.salesViewing.upsert({
      where: { uuid: seedUuid('sales-viewing-completion', String(index + 1)) },
      update: { opportunityUuid: opportunity.uuid, propertyUuid: property.uuid, contactUuid: contact.uuid, scheduledAt: dateOffset(index - 8, 13), status: index % 4 === 0 ? 'COMPLETED' : index % 5 === 0 ? 'CANCELLED' : 'REQUESTED', notes: `Viewing scenario ${index + 1}.`, actorUserUuid: ownerUserUuid },
      create: { uuid: seedUuid('sales-viewing-completion', String(index + 1)), opportunityUuid: opportunity.uuid, propertyUuid: property.uuid, contactUuid: contact.uuid, scheduledAt: dateOffset(index - 8, 13), status: index % 4 === 0 ? 'COMPLETED' : index % 5 === 0 ? 'CANCELLED' : 'REQUESTED', notes: `Viewing scenario ${index + 1}.`, actorUserUuid: ownerUserUuid },
    });

    if (stageCode === 'WON') {
      const dealAmount = amount - 75_000_000;
      const deal = await tx.salesDeal.upsert({
        where: { opportunityUuid: opportunity.uuid },
        update: { offerUuid: offer.uuid, status: 'WON', ownerUserUuid, currency: 'IDR', totalAmount: String(dealAmount), version: 1, idempotencyKey: `seed-sales-deal-completion-${index + 1}` },
        create: { uuid: seedUuid('sales-deal-completion', String(index + 1)), opportunityUuid: opportunity.uuid, offerUuid: offer.uuid, status: 'WON', ownerUserUuid, currency: 'IDR', totalAmount: String(dealAmount), version: 1, idempotencyKey: `seed-sales-deal-completion-${index + 1}` },
      });
      await tx.salesDealItem.upsert({
        where: { uuid: seedUuid('sales-deal-item-completion', String(index + 1)) },
        update: { dealUuid: deal.uuid, propertyUuid: property.uuid, description: `Property purchase item ${index + 1}`, quantity: 1, unitAmount: String(dealAmount), lineAmount: String(dealAmount), currency: 'IDR' },
        create: { uuid: seedUuid('sales-deal-item-completion', String(index + 1)), dealUuid: deal.uuid, propertyUuid: property.uuid, description: `Property purchase item ${index + 1}`, quantity: 1, unitAmount: String(dealAmount), lineAmount: String(dealAmount), currency: 'IDR' },
      });
      await tx.salesClosing.upsert({
        where: { dealUuid: deal.uuid },
        update: { method: index % 2 === 0 ? 'BANK_TRANSFER' : 'MORTGAGE', closedAt: dateOffset(index - 3, 16), actorUserUuid: ownerUserUuid, idempotencyKey: `seed-sales-closing-completion-${index + 1}` },
        create: { uuid: seedUuid('sales-closing-completion', String(index + 1)), dealUuid: deal.uuid, method: index % 2 === 0 ? 'BANK_TRANSFER' : 'MORTGAGE', closedAt: dateOffset(index - 3, 16), actorUserUuid: ownerUserUuid, idempotencyKey: `seed-sales-closing-completion-${index + 1}` },
      });
      await tx.salesCommission.upsert({
        where: { dealUuid: deal.uuid },
        update: { ruleUuid: commissionRule.uuid, baseAmount: String(dealAmount), ratePercent: commissionRule.ratePercent, amount: String(dealAmount * 0.025), currency: 'IDR', status: index % 3 === 0 ? 'SETTLED' : index % 3 === 1 ? 'APPROVED' : 'PENDING', calculatedAt: dateOffset(index - 2, 17), approvedAt: index % 3 === 2 ? null : dateOffset(index - 1, 10), settledAt: index % 3 === 0 ? dateOffset(index, 10) : null, idempotencyKey: `seed-sales-commission-completion-${index + 1}` },
        create: { uuid: seedUuid('sales-commission-completion', String(index + 1)), dealUuid: deal.uuid, ruleUuid: commissionRule.uuid, baseAmount: String(dealAmount), ratePercent: commissionRule.ratePercent, amount: String(dealAmount * 0.025), currency: 'IDR', status: index % 3 === 0 ? 'SETTLED' : index % 3 === 1 ? 'APPROVED' : 'PENDING', calculatedAt: dateOffset(index - 2, 17), approvedAt: index % 3 === 2 ? null : dateOffset(index - 1, 10), settledAt: index % 3 === 0 ? dateOffset(index, 10) : null, idempotencyKey: `seed-sales-commission-completion-${index + 1}` },
      });
    }
  }
}
