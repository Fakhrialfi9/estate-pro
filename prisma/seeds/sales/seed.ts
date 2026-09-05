import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';
import { SALES_PIPELINE, SALES_STAGES } from './data.ts';

export async function seedSales(tx: SeedTransaction): Promise<void> {
  const pipeline = await tx.salesPipeline.upsert({
    where: { uuid: SALES_PIPELINE.uuid },
    update: { name: SALES_PIPELINE.name, status: SALES_PIPELINE.status, sortOrder: 0 },
    create: { uuid: SALES_PIPELINE.uuid, name: SALES_PIPELINE.name, status: SALES_PIPELINE.status, sortOrder: 0 },
  });

  const stageUuids = new Map<string, string>();
  for (const [code, name, probability, isTerminal, sortOrder] of SALES_STAGES) {
    const uuid = seedUuid('sales-stage', code);
    stageUuids.set(code, uuid);
    await tx.salesPipelineStage.upsert({
      where: { pipelineUuid_code: { pipelineUuid: pipeline.uuid, code } },
      update: { uuid, name, probability, isTerminal, isActive: true, sortOrder },
      create: { uuid, pipelineUuid: pipeline.uuid, code, name, probability, isTerminal, isActive: true, sortOrder },
    });
  }

  const lostReason = await tx.salesLostReason.upsert({
    where: { code: 'PRICE' },
    update: { name: 'Price / budget mismatch', isActive: true },
    create: { uuid: seedUuid('sales-lost-reason', 'PRICE'), code: 'PRICE', name: 'Price / budget mismatch', isActive: true },
  });
  await tx.salesLostReason.upsert({
    where: { code: 'COMPETITOR' },
    update: { name: 'Lost to competitor', isActive: true },
    create: { uuid: seedUuid('sales-lost-reason', 'COMPETITOR'), code: 'COMPETITOR', name: 'Lost to competitor', isActive: true },
  });
  const commissionRule = await tx.salesCommissionRule.upsert({
    where: { code: 'STANDARD_2_5' },
    update: { name: 'Standard 2.5%', ratePercent: '2.5000', isActive: true },
    create: { uuid: seedUuid('sales-commission-rule', 'STANDARD_2_5'), code: 'STANDARD_2_5', name: 'Standard 2.5%', ratePercent: '2.5000', isActive: true },
  });

  const leadUuid = seedUuid('crm-lead', 'LEAD-SEED-001');
  const contactUuid = seedUuid('crm-contact', 'buyer-01');
  const propertyUuid = seedUuid('property', 'dago-apartment');
  const opportunityUuid = seedUuid('sales-opportunity', 'LEAD-SEED-001');
  const stageUuid = stageUuids.get('NEGOTIATING');
  if (!stageUuid) throw new Error('Missing NEGOTIATING sales stage fixture');

  const opportunity = await tx.salesOpportunity.upsert({
    where: { leadUuid },
    update: { contactUuid, ownerUserUuid: '00000000-0000-5000-8000-000000000003', pipelineUuid: pipeline.uuid, stageUuid, propertyUuid, title: 'Nadia — Dago Skyline Apartment', valueAmount: '2350000000', currency: 'IDR', status: 'OPEN', version: 1, idempotencyKey: 'seed-opportunity-001' },
    create: { uuid: opportunityUuid, leadUuid, contactUuid, ownerUserUuid: '00000000-0000-5000-8000-000000000003', pipelineUuid: pipeline.uuid, stageUuid, propertyUuid, title: 'Nadia — Dago Skyline Apartment', valueAmount: '2350000000', currency: 'IDR', status: 'OPEN', version: 1, idempotencyKey: 'seed-opportunity-001' },
  });

  await tx.salesOpportunityStageHistory.deleteMany({ where: { opportunityUuid: opportunity.uuid } });
  await tx.salesOpportunityStageHistory.create({
    data: { uuid: seedUuid('sales-stage-history', opportunity.uuid), opportunityUuid: opportunity.uuid, fromStageUuid: stageUuids.get('QUALIFIED'), toStageUuid: stageUuid, fromStatus: 'OPEN', toStatus: 'OPEN', actorUserUuid: '00000000-0000-5000-8000-000000000003', reason: 'Seed opportunity moved to negotiation.', occurredAt: SEED_REFERENCE_DATE },
  });

  await tx.salesActivity.upsert({
    where: { uuid: seedUuid('sales-activity', 'seed-001') },
    update: { opportunityUuid: opportunity.uuid, actorUserUuid: '00000000-0000-5000-8000-000000000003', type: 'FOLLOW_UP', status: 'OPEN', subject: 'Follow up on Dago apartment offer', body: 'Review financing preference and schedule viewing.', dueAt: new Date('2026-01-05T09:00:00.000Z') },
    create: { uuid: seedUuid('sales-activity', 'seed-001'), opportunityUuid: opportunity.uuid, actorUserUuid: '00000000-0000-5000-8000-000000000003', type: 'FOLLOW_UP', status: 'OPEN', subject: 'Follow up on Dago apartment offer', body: 'Review financing preference and schedule viewing.', dueAt: new Date('2026-01-05T09:00:00.000Z') },
  });
  await tx.salesViewing.upsert({
    where: { uuid: seedUuid('sales-viewing', 'seed-001') },
    update: { opportunityUuid: opportunity.uuid, propertyUuid, contactUuid, scheduledAt: new Date('2026-01-06T08:00:00.000Z'), status: 'REQUESTED', notes: 'Initial site viewing.', actorUserUuid: '00000000-0000-5000-8000-000000000003' },
    create: { uuid: seedUuid('sales-viewing', 'seed-001'), opportunityUuid: opportunity.uuid, propertyUuid, contactUuid, scheduledAt: new Date('2026-01-06T08:00:00.000Z'), status: 'REQUESTED', notes: 'Initial site viewing.', actorUserUuid: '00000000-0000-5000-8000-000000000003' },
  });

  const negotiation = await tx.salesNegotiation.upsert({
    where: { uuid: seedUuid('sales-negotiation', 'seed-001') },
    update: { opportunityUuid: opportunity.uuid, openedByUuid: '00000000-0000-5000-8000-000000000003', status: 'OPEN', notes: 'Initial purchase negotiation.', version: 1 },
    create: { uuid: seedUuid('sales-negotiation', 'seed-001'), opportunityUuid: opportunity.uuid, openedByUuid: '00000000-0000-5000-8000-000000000003', status: 'OPEN', notes: 'Initial purchase negotiation.', version: 1 },
  });
  await tx.salesNegotiationHistory.deleteMany({ where: { negotiationUuid: negotiation.uuid } });
  await tx.salesNegotiationHistory.create({ data: { uuid: seedUuid('sales-negotiation-history', 'seed-001'), negotiationUuid: negotiation.uuid, toStatus: 'OPEN', actorUserUuid: '00000000-0000-5000-8000-000000000003', occurredAt: SEED_REFERENCE_DATE } });
  const offer = await tx.salesOffer.upsert({
    where: { negotiationUuid_version: { negotiationUuid: negotiation.uuid, version: 1 } },
    update: { amount: '2250000000', currency: 'IDR', status: 'DRAFT', expiresAt: new Date('2026-01-15T00:00:00.000Z'), actorUserUuid: '00000000-0000-5000-8000-000000000003' },
    create: { uuid: seedUuid('sales-offer', 'seed-001:v1'), negotiationUuid: negotiation.uuid, version: 1, amount: '2250000000', currency: 'IDR', status: 'DRAFT', expiresAt: new Date('2026-01-15T00:00:00.000Z'), actorUserUuid: '00000000-0000-5000-8000-000000000003' },
  });

  // Keep the commission rule referenced so seed coverage verifies its availability;
  // deals/closures remain empty until the opportunity reaches a terminal state.
  void lostReason;
  void commissionRule;
  void offer;
}
