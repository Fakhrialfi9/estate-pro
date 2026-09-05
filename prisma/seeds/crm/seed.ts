import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';
import { LEAD_CAMPAIGNS, LEAD_SCORE_RULES, LEAD_SOURCES, LEAD_TAGS, LEAD_TYPES } from './data.ts';

const STATUS_ROWS = [
  ['NEW', 'New', 1, false],
  ['CONTACTED', 'Contacted', 2, false],
  ['QUALIFIED', 'Qualified', 3, false],
  ['NURTURING', 'Nurturing', 4, false],
  ['CLOSED_WON', 'Closed Won', 5, true],
  ['CLOSED_LOST', 'Closed Lost', 6, true],
  ['ARCHIVED', 'Archived', 7, true],
] as const;

const TRANSITIONS = [
  ['NEW', 'CONTACTED'], ['NEW', 'ARCHIVED'],
  ['CONTACTED', 'QUALIFIED'], ['CONTACTED', 'NURTURING'], ['CONTACTED', 'CLOSED_LOST'], ['CONTACTED', 'ARCHIVED'],
  ['QUALIFIED', 'NURTURING'], ['QUALIFIED', 'CLOSED_WON'], ['QUALIFIED', 'CLOSED_LOST'], ['QUALIFIED', 'ARCHIVED'],
  ['NURTURING', 'CONTACTED'], ['NURTURING', 'QUALIFIED'], ['NURTURING', 'CLOSED_WON'], ['NURTURING', 'CLOSED_LOST'], ['NURTURING', 'ARCHIVED'],
  ['CLOSED_LOST', 'CONTACTED'], ['CLOSED_WON', 'CONTACTED'], ['ARCHIVED', 'CONTACTED'],
] as const;

export async function seedCrm(tx: SeedTransaction): Promise<void> {
  const statusIds = new Map<string, bigint>();
  for (const [code, name, sortOrder, isClosed] of STATUS_ROWS) {
    const row = await tx.crmLeadStatus.upsert({
      where: { code },
      update: { name, sortOrder, isClosed, isActive: true, deletedAt: null },
      create: { uuid: seedUuid('crm-status', code), code, name, sortOrder, isClosed },
    });
    statusIds.set(code, row.id);
  }
  for (const [from, to] of TRANSITIONS) {
    const fromStatusId = statusIds.get(from);
    const toStatusId = statusIds.get(to);
    if (fromStatusId === undefined || toStatusId === undefined) throw new Error(`Invalid CRM status transition fixture: ${from} -> ${to}`);
    await tx.crmLeadStatusTransition.upsert({
      where: { fromStatusId_toStatusId: { fromStatusId, toStatusId } },
      update: {},
      create: { uuid: seedUuid('crm-status-transition', `${from}:${to}`), fromStatusId, toStatusId },
    });
  }

  const sourceIds = new Map<string, bigint>();
  for (const source of LEAD_SOURCES) {
    const row = await tx.crmLeadSource.upsert({
      where: { code: source.code },
      update: { name: source.name, description: source.description, isActive: true, deletedAt: null },
      create: { uuid: seedUuid('crm-source', source.code), code: source.code, name: source.name, description: source.description },
    });
    sourceIds.set(source.code, row.id);
  }
  for (const campaign of LEAD_CAMPAIGNS) {
    const sourceId = sourceIds.get(campaign.sourceCode);
    if (sourceId === undefined) throw new Error(`Missing CRM source fixture: ${campaign.sourceCode}`);
    await tx.crmLeadCampaign.upsert({
      where: { code: campaign.code },
      update: { sourceId, name: campaign.name, startsAt: new Date(campaign.startsAt), endsAt: new Date(campaign.endsAt), isActive: true, deletedAt: null },
      create: { uuid: seedUuid('crm-campaign', campaign.code), sourceId, code: campaign.code, name: campaign.name, startsAt: new Date(campaign.startsAt), endsAt: new Date(campaign.endsAt) },
    });
  }
  for (const type of LEAD_TYPES) {
    await tx.crmLeadType.upsert({
      where: { code: type.code },
      update: { name: type.name, isActive: true, deletedAt: null },
      create: { uuid: seedUuid('crm-lead-type', type.code), code: type.code, name: type.name },
    });
  }
  for (const [index, tag] of LEAD_TAGS.entries()) {
    await tx.crmLeadTag.upsert({
      where: { code: tag.code },
      update: { name: tag.name, isActive: true },
      create: { uuid: seedUuid('crm-tag', tag.code), code: tag.code, name: tag.name, color: ['red', 'blue', 'green', 'orange', 'purple'][index] },
    });
  }
  for (const rule of LEAD_SCORE_RULES) {
    await tx.crmLeadScoreRule.upsert({
      where: { code: rule.code },
      update: { field: rule.field, operator: rule.operator, value: rule.value, points: rule.points, priority: rule.priority, version: 1, isActive: true },
      create: { uuid: seedUuid('crm-score-rule', rule.code), code: rule.code, field: rule.field, operator: rule.operator, value: rule.value, points: rule.points, priority: rule.priority, version: 1 },
    });
  }

  // A small, fully deterministic contact fixture exercises the CRM aggregate while
  // avoiding production-like PII. These records intentionally point to test users only.
  const contact = await tx.crmContact.upsert({
    where: { uuid: seedUuid('crm-contact', 'buyer-01') },
    update: { firstName: 'Nadia', lastName: 'Pratama', displayName: 'Nadia Pratama', companyName: 'Nadia Property Group', jobTitle: 'Director', status: 'ACTIVE', ownerUserUuid: '00000000-0000-5000-8000-000000000002', source: 'WEBSITE', archivedAt: null },
    create: { uuid: seedUuid('crm-contact', 'buyer-01'), firstName: 'Nadia', lastName: 'Pratama', displayName: 'Nadia Pratama', companyName: 'Nadia Property Group', jobTitle: 'Director', status: 'ACTIVE', ownerUserUuid: '00000000-0000-5000-8000-000000000002', source: 'WEBSITE' },
  });
  await tx.crmContactEmail.upsert({
    where: { normalizedValue: 'nadia.pratama@example.test' },
    update: { contactId: contact.id, value: 'nadia.pratama@example.test', type: 'WORK', isPrimary: true, isVerified: true },
    create: { uuid: seedUuid('crm-contact-email', 'buyer-01'), contactId: contact.id, type: 'WORK', value: 'nadia.pratama@example.test', normalizedValue: 'nadia.pratama@example.test', isPrimary: true, isVerified: true },
  });
  await tx.crmContactPhone.upsert({
    where: { normalizedValue: '+6281200000001' },
    update: { contactId: contact.id, value: '+6281200000001', type: 'MOBILE', isPrimary: true, isVerified: true },
    create: { uuid: seedUuid('crm-contact-phone', 'buyer-01'), contactId: contact.id, type: 'MOBILE', value: '+6281200000001', normalizedValue: '+6281200000001', isPrimary: true, isVerified: true },
  });
  await tx.crmContactPreference.upsert({
    where: { contactId: contact.id },
    update: { preferredChannel: 'EMAIL', preferredLanguage: 'id', marketingEmail: false, marketingSms: false, marketingWhatsapp: true, timezone: 'Asia/Jakarta' },
    create: { uuid: seedUuid('crm-contact-preference', 'buyer-01'), contactId: contact.id, preferredChannel: 'EMAIL', preferredLanguage: 'id', marketingEmail: false, marketingSms: false, marketingWhatsapp: true, timezone: 'Asia/Jakarta' },
  });

  const sourceId = sourceIds.get('WEBSITE');
  const campaign = await tx.crmLeadCampaign.findUniqueOrThrow({ where: { code: 'WEBSITE_ORGANIC' }, select: { id: true } });
  const type = await tx.crmLeadType.findUniqueOrThrow({ where: { code: 'BUYER' }, select: { id: true } });
  const statusId = statusIds.get('QUALIFIED');
  if (sourceId === undefined || statusId === undefined) throw new Error('CRM lead fixture dependencies are incomplete');
  const lead = await tx.crmLead.upsert({
    where: { code: 'LEAD-SEED-001' },
    update: { contactId: contact.id, sourceId, campaignId: campaign.id, typeId: type.id, statusId, ownerUserUuid: '00000000-0000-5000-8000-000000000002', score: 50, scoreVersion: 1, qualifiedAt: SEED_REFERENCE_DATE, qualificationReason: 'Seed qualified buyer fixture', archivedAt: null },
    create: { uuid: seedUuid('crm-lead', 'LEAD-SEED-001'), code: 'LEAD-SEED-001', contactId: contact.id, sourceId, campaignId: campaign.id, typeId: type.id, statusId, ownerUserUuid: '00000000-0000-5000-8000-000000000002', score: 50, scoreVersion: 1, qualifiedAt: SEED_REFERENCE_DATE, qualificationReason: 'Seed qualified buyer fixture' },
  });
  const hotTag = await tx.crmLeadTag.findUniqueOrThrow({ where: { code: 'HOT' }, select: { id: true } });
  await tx.crmLeadTagLink.upsert({ where: { leadId_tagId: { leadId: lead.id, tagId: hotTag.id } }, update: {}, create: { leadId: lead.id, tagId: hotTag.id } });
  await tx.crmLeadHistory.createMany({ data: [{ uuid: seedUuid('crm-lead-history', 'LEAD-SEED-001:created'), leadId: lead.id, eventType: 'CREATED', toValue: 'NEW', actorUserUuid: '00000000-0000-5000-8000-000000000001', summary: 'Seed lead created.', createdAt: SEED_REFERENCE_DATE }] , skipDuplicates: true });
  await tx.crmLeadScore.deleteMany({ where: { leadId: lead.id } });
  await tx.crmLeadScore.create({ data: { uuid: seedUuid('crm-lead-score', 'LEAD-SEED-001:qualified'), leadId: lead.id, ruleCode: 'STATUS_QUALIFIED', points: 30, explanation: 'Qualified status fixture score.', calculatedAt: SEED_REFERENCE_DATE } });
}
