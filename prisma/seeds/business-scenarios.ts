import type { SeedTransaction } from './database.ts';
import { SEED_REFERENCE_DATE, seedUuid } from './shared/ids.ts';

const USER_UUIDS = [
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

const CONTACT_NAMES = [
  ['Nadia', 'Putri', 'Digital Marketing Manager'],
  ['Andi', 'Prabowo', 'Operations Director'],
  ['Citra', 'Laksmi', 'Finance Manager'],
  ['Fajar', 'Ramadhan', 'Entrepreneur'],
  ['Gita', 'Permata', 'Architect'],
  ['Hendra', 'Wijaya', 'Investment Manager'],
  ['Intan', 'Kusuma', 'HR Director'],
  ['Joko', 'Santoso', 'Business Owner'],
  ['Karin', 'Maharani', 'Technology Lead'],
  ['Lukman', 'Hakim', 'Property Investor'],
  ['Maya', 'Anggraini', 'Consultant'],
  ['Naufal', 'Rizki', 'Product Manager'],
  ['Olivia', 'Prameswari', 'Legal Counsel'],
  ['Putra', 'Aditya', 'Founder'],
  ['Qori', 'Aulia', 'Procurement Manager'],
  ['Raka', 'Wibowo', 'Sales Director'],
  ['Sarah', 'Nirmala', 'Creative Director'],
  ['Taufik', 'Hidayat', 'Finance Director'],
  ['Vina', 'Sari', 'Business Development Manager'],
  ['Yusuf', 'Maulana', 'Investment Analyst'],
] as const;

const LEAD_STATUS_CODES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'NURTURING',
  'CLOSED_WON',
  'CLOSED_LOST',
  'ARCHIVED',
] as const;

const ACTIVITY_TYPES = ['CALL', 'MEETING', 'TASK', 'NOTE', 'FOLLOW_UP', 'REMINDER'] as const;
const CONTACT_CHANNELS = ['EMAIL', 'PHONE', 'WHATSAPP'] as const;

function dateOffset(days: number, hours = 9): Date {
  const value = new Date(SEED_REFERENCE_DATE.getTime());
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hours, 0, 0, 0);
  return value;
}

async function seedContactsAndLeads(tx: SeedTransaction): Promise<void> {
  const sources = await tx.crmLeadSource.findMany({ orderBy: { id: 'asc' } });
  const campaigns = await tx.crmLeadCampaign.findMany({ orderBy: { id: 'asc' } });
  const types = await tx.crmLeadType.findMany({ orderBy: { id: 'asc' } });
  const statuses = await tx.crmLeadStatus.findMany({ orderBy: { sortOrder: 'asc' } });
  const tags = await tx.crmLeadTag.findMany({ orderBy: { id: 'asc' }, take: 5 });
  const scoreRules = await tx.crmLeadScoreRule.findMany({ orderBy: { priority: 'asc' } });

  if (!sources.length || !types.length || !statuses.length) {
    throw new Error('CRM reference fixtures are required before business scenarios are seeded');
  }

  for (let index = 0; index < CONTACT_NAMES.length; index += 1) {
    const [firstName, lastName, jobTitle] = CONTACT_NAMES[index];
    const contactUuid = seedUuid('crm-contact', `business-${String(index + 1).padStart(2, '0')}`);
    const ownerUserUuid = USER_UUIDS[index % USER_UUIDS.length];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@estate-pro.example.test`;
    const phone = `+62812900${String(index + 1).padStart(5, '0')}`;

    const contact = await tx.crmContact.upsert({
      where: { uuid: contactUuid },
      update: {
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        companyName: `${lastName} Holdings`,
        jobTitle,
        status: index === 19 ? 'ARCHIVED' : 'ACTIVE',
        ownerUserUuid,
        source: sources[index % sources.length]?.code,
        archivedAt: index === 19 ? dateOffset(-30) : null,
      },
      create: {
        uuid: contactUuid,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        companyName: `${lastName} Holdings`,
        jobTitle,
        status: index === 19 ? 'ARCHIVED' : 'ACTIVE',
        ownerUserUuid,
        source: sources[index % sources.length]?.code,
        archivedAt: index === 19 ? dateOffset(-30) : null,
      },
    });

    await tx.crmContactEmail.upsert({
      where: { normalizedValue: email },
      update: { contactId: contact.id, type: 'WORK', value: email, isPrimary: true, isVerified: true },
      create: { uuid: seedUuid('crm-contact-email', contactUuid), contactId: contact.id, type: 'WORK', value: email, normalizedValue: email, isPrimary: true, isVerified: true },
    });
    await tx.crmContactPhone.upsert({
      where: { normalizedValue: phone },
      update: { contactId: contact.id, type: 'MOBILE', value: phone, isPrimary: true, isVerified: index % 3 !== 0 },
      create: { uuid: seedUuid('crm-contact-phone', contactUuid), contactId: contact.id, type: 'MOBILE', value: phone, normalizedValue: phone, isPrimary: true, isVerified: index % 3 !== 0 },
    });
    await tx.crmContactAddress.upsert({
      where: { uuid: seedUuid('crm-contact-address', contactUuid) },
      update: { contactId: contact.id, type: 'HOME', line1: `${10 + index} Jl. Merdeka`, city: index % 2 === 0 ? 'Jakarta Selatan' : 'Kota Bandung', region: index % 2 === 0 ? 'DKI Jakarta' : 'Jawa Barat', postalCode: index % 2 === 0 ? '12190' : '40135', countryCode: 'ID', isPrimary: true },
      create: { uuid: seedUuid('crm-contact-address', contactUuid), contactId: contact.id, type: 'HOME', line1: `${10 + index} Jl. Merdeka`, city: index % 2 === 0 ? 'Jakarta Selatan' : 'Kota Bandung', region: index % 2 === 0 ? 'DKI Jakarta' : 'Jawa Barat', postalCode: index % 2 === 0 ? '12190' : '40135', countryCode: 'ID', isPrimary: true },
    });
    await tx.crmContactPreference.upsert({
      where: { contactId: contact.id },
      update: { preferredChannel: CONTACT_CHANNELS[index % CONTACT_CHANNELS.length], preferredLanguage: 'id', marketingEmail: index % 2 === 0, marketingSms: index % 3 === 0, marketingWhatsapp: index % 2 === 1, timezone: 'Asia/Jakarta' },
      create: { uuid: seedUuid('crm-contact-preference', contactUuid), contactId: contact.id, preferredChannel: CONTACT_CHANNELS[index % CONTACT_CHANNELS.length], preferredLanguage: 'id', marketingEmail: index % 2 === 0, marketingSms: index % 3 === 0, marketingWhatsapp: index % 2 === 1, timezone: 'Asia/Jakarta' },
    });

    await tx.crmContactConsent.upsert({
      where: { uuid: seedUuid('crm-consent', contactUuid) },
      update: { contactId: contact.id, consentType: 'MARKETING', status: index % 5 === 0 ? 'REVOKED' : 'GRANTED', source: 'SEED', grantedAt: dateOffset(-60), revokedAt: index % 5 === 0 ? dateOffset(-10) : null, actorUserUuid: ownerUserUuid },
      create: { uuid: seedUuid('crm-consent', contactUuid), contactId: contact.id, consentType: 'MARKETING', status: index % 5 === 0 ? 'REVOKED' : 'GRANTED', source: 'SEED', grantedAt: dateOffset(-60), revokedAt: index % 5 === 0 ? dateOffset(-10) : null, actorUserUuid: ownerUserUuid },
    });

    if (index > 0) {
      const previousContactUuid = seedUuid('crm-contact', `business-${String(index).padStart(2, '0')}`);
      const previous = await tx.crmContact.findUnique({ where: { uuid: previousContactUuid }, select: { id: true } });
      if (previous) {
        await tx.crmContactRelationship.upsert({
          where: { fromContactId_toContactId_relationshipType: { fromContactId: previous.id, toContactId: contact.id, relationshipType: 'REFERRAL' } },
          update: { isReciprocal: false },
          create: { uuid: seedUuid('crm-contact-relationship', `${previousContactUuid}:${contactUuid}`), fromContactId: previous.id, toContactId: contact.id, relationshipType: 'REFERRAL', isReciprocal: false },
        });
      }
    }

    const status = statuses.find((item) => item.code === LEAD_STATUS_CODES[index % LEAD_STATUS_CODES.length]) ?? statuses[index % statuses.length];
    const source = sources[index % sources.length];
    const type = types[index % types.length];
    const campaign = campaigns.length ? campaigns[index % campaigns.length] : null;
    const leadCode = `LEAD-SEED-${String(index + 1).padStart(3, '0')}`;
    const lead = await tx.crmLead.upsert({
      where: { code: leadCode },
      update: {
        contactId: contact.id,
        sourceId: source.id,
        campaignId: campaign?.id,
        typeId: type.id,
        statusId: status.id,
        ownerUserUuid,
        score: 40 + ((index * 7) % 61),
        scoreVersion: 1,
        qualifiedAt: ['QUALIFIED', 'CLOSED_WON', 'CLOSED_LOST'].includes(status.code) ? dateOffset(-15) : null,
        qualificationReason: ['QUALIFIED', 'CLOSED_WON', 'CLOSED_LOST'].includes(status.code) ? 'Budget, location and purchase timeline validated.' : null,
        closedAt: ['CLOSED_WON', 'CLOSED_LOST', 'ARCHIVED'].includes(status.code) ? dateOffset(-7) : null,
        closureReason: ['CLOSED_WON', 'CLOSED_LOST'].includes(status.code) ? 'Seed lifecycle scenario.' : null,
        closureOutcome: status.code === 'CLOSED_WON' ? 'WON' : status.code === 'CLOSED_LOST' ? 'LOST' : null,
        convertedAt: status.code === 'CLOSED_WON' ? dateOffset(-5) : null,
        conversionKey: status.code === 'CLOSED_WON' ? `seed-conversion-${index + 1}` : null,
        archivedAt: status.code === 'ARCHIVED' ? dateOffset(-30) : null,
      },
      create: {
        uuid: seedUuid('crm-lead', leadCode),
        code: leadCode,
        contactId: contact.id,
        sourceId: source.id,
        campaignId: campaign?.id,
        typeId: type.id,
        statusId: status.id,
        ownerUserUuid,
        score: 40 + ((index * 7) % 61),
        qualificationReason: ['QUALIFIED', 'CLOSED_WON', 'CLOSED_LOST'].includes(status.code) ? 'Budget, location and purchase timeline validated.' : null,
        qualifiedAt: ['QUALIFIED', 'CLOSED_WON', 'CLOSED_LOST'].includes(status.code) ? dateOffset(-15) : null,
        closedAt: ['CLOSED_WON', 'CLOSED_LOST', 'ARCHIVED'].includes(status.code) ? dateOffset(-7) : null,
        closureReason: ['CLOSED_WON', 'CLOSED_LOST'].includes(status.code) ? 'Seed lifecycle scenario.' : null,
        closureOutcome: status.code === 'CLOSED_WON' ? 'WON' : status.code === 'CLOSED_LOST' ? 'LOST' : null,
        convertedAt: status.code === 'CLOSED_WON' ? dateOffset(-5) : null,
        conversionKey: status.code === 'CLOSED_WON' ? `seed-conversion-${index + 1}` : null,
        archivedAt: status.code === 'ARCHIVED' ? dateOffset(-30) : null,
      },
    });

    const tag = tags[index % tags.length];
    if (tag) {
      await tx.crmLeadTagLink.upsert({ where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } }, update: {}, create: { leadId: lead.id, tagId: tag.id } });
    }
    const scoreRule = scoreRules[index % scoreRules.length];
    if (scoreRule) {
      await tx.crmLeadScore.upsert({
        where: { uuid: seedUuid('crm-lead-score', leadCode) },
        update: { leadId: lead.id, ruleCode: scoreRule.code, points: 5 + (index % 20), explanation: `Deterministic score fixture for ${scoreRule.code}`, calculatedAt: dateOffset(-index) },
        create: { uuid: seedUuid('crm-lead-score', leadCode), leadId: lead.id, ruleCode: scoreRule.code, points: 5 + (index % 20), explanation: `Deterministic score fixture for ${scoreRule.code}`, calculatedAt: dateOffset(-index) },
      });
    }
    await tx.crmLeadNote.upsert({
      where: { uuid: seedUuid('crm-lead-note', leadCode) },
      update: { leadId: lead.id, authorUserUuid: ownerUserUuid, body: `Buyer journey note for ${firstName} ${lastName}.` },
      create: { uuid: seedUuid('crm-lead-note', leadCode), leadId: lead.id, authorUserUuid: ownerUserUuid, body: `Buyer journey note for ${firstName} ${lastName}.` },
    });
    await tx.crmLeadAssignment.upsert({
      where: { uuid: seedUuid('crm-lead-assignment', leadCode) },
      update: { leadId: lead.id, assigneeUserUuid: ownerUserUuid, assignedByUserUuid: USER_UUIDS[0], assignedAt: dateOffset(-20), unassignedAt: null },
      create: { uuid: seedUuid('crm-lead-assignment', leadCode), leadId: lead.id, assigneeUserUuid: ownerUserUuid, assignedByUserUuid: USER_UUIDS[0], assignedAt: dateOffset(-20) },
    });
    await tx.crmLeadHistory.upsert({
      where: { uuid: seedUuid('crm-lead-history', leadCode) },
      update: { leadId: lead.id, eventType: 'STATUS_CHANGED', fromValue: 'NEW', toValue: status.code, summary: `Lifecycle moved to ${status.name}.`, actorUserUuid: ownerUserUuid, createdAt: dateOffset(-10) },
      create: { uuid: seedUuid('crm-lead-history', leadCode), leadId: lead.id, eventType: 'STATUS_CHANGED', fromValue: 'NEW', toValue: status.code, summary: `Lifecycle moved to ${status.name}.`, actorUserUuid: ownerUserUuid, createdAt: dateOffset(-10) },
    });
  }
}

async function seedCrmActivitiesAndCommunications(tx: SeedTransaction): Promise<void> {
  const leads = await tx.crmLead.findMany({ orderBy: { id: 'asc' }, take: 20 });
  const templates = await tx.crmCommunicationTemplate.findMany({ orderBy: { id: 'asc' } });
  for (let index = 0; index < 30; index += 1) {
    const lead = leads[index % leads.length];
    const contact = lead ? await tx.crmContact.findUnique({ where: { id: lead.contactId } }) : null;
    const activityUuid = seedUuid('crm-activity-business', String(index + 1));
    const activity = await tx.crmActivity.upsert({
      where: { uuid: activityUuid },
      update: { type: ACTIVITY_TYPES[index % ACTIVITY_TYPES.length], status: index % 5 === 0 ? 'COMPLETED' : index % 7 === 0 ? 'CANCELLED' : 'CREATED', priority: index % 4 === 0 ? 'HIGH' : 'NORMAL', subject: `CRM ${ACTIVITY_TYPES[index % ACTIVITY_TYPES.length]} #${index + 1}`, description: 'Deterministic development activity timeline fixture.', contactId: contact?.id, leadId: lead?.id, assigneeUserUuid: USER_UUIDS[index % USER_UUIDS.length], dueAt: dateOffset(index - 15, 10), startedAt: index % 5 === 0 ? dateOffset(index - 16, 10) : null, completedAt: index % 5 === 0 ? dateOffset(index - 15, 11) : null, callOutcome: index % 6 === 0 ? 'CONNECTED' : null, durationSeconds: index % 6 === 0 ? 900 : null, meetingStartAt: index % 8 === 0 ? dateOffset(index - 15, 13) : null, meetingEndAt: index % 8 === 0 ? dateOffset(index - 15, 14) : null, location: index % 8 === 0 ? 'Estate Pro Meeting Room' : null, reminderAt: index % 5 !== 0 ? dateOffset(index - 16, 8) : null },
      create: { uuid: activityUuid, type: ACTIVITY_TYPES[index % ACTIVITY_TYPES.length], status: index % 5 === 0 ? 'COMPLETED' : index % 7 === 0 ? 'CANCELLED' : 'CREATED', priority: index % 4 === 0 ? 'HIGH' : 'NORMAL', subject: `CRM ${ACTIVITY_TYPES[index % ACTIVITY_TYPES.length]} #${index + 1}`, description: 'Deterministic development activity timeline fixture.', contactId: contact?.id, leadId: lead?.id, assigneeUserUuid: USER_UUIDS[index % USER_UUIDS.length], dueAt: dateOffset(index - 15, 10), startedAt: index % 5 === 0 ? dateOffset(index - 16, 10) : null, completedAt: index % 5 === 0 ? dateOffset(index - 15, 11) : null, callOutcome: index % 6 === 0 ? 'CONNECTED' : null, durationSeconds: index % 6 === 0 ? 900 : null, meetingStartAt: index % 8 === 0 ? dateOffset(index - 15, 13) : null, meetingEndAt: index % 8 === 0 ? dateOffset(index - 15, 14) : null, location: index % 8 === 0 ? 'Estate Pro Meeting Room' : null, reminderAt: index % 5 !== 0 ? dateOffset(index - 16, 8) : null },
    });

    if (contact) {
      const email = `${contact.firstName.toLowerCase()}.${contact.lastName?.toLowerCase() ?? 'contact'}@estate-pro.example.test`;
      const template = templates[index % templates.length];
      await tx.crmCommunication.upsert({
        where: { uuid: seedUuid('crm-communication-business', String(index + 1)) },
        update: { channel: CONTACT_CHANNELS[index % CONTACT_CHANNELS.length], direction: index % 3 === 0 ? 'OUTBOUND' : 'INBOUND', status: index % 6 === 0 ? 'FAILED' : index % 4 === 0 ? 'DELIVERED' : 'SENT', contactId: contact.id, leadId: lead?.id, activityId: activity.id, templateId: template?.id, providerName: 'seed-provider', providerMessageId: `seed-message-${index + 1}`, providerError: index % 6 === 0 ? 'Simulated provider timeout.' : null, destination: email, subject: `Estate Pro update #${index + 1}`, body: 'Deterministic communication fixture.', idempotencyKey: `crm-communication-seed-${index + 1}`, queuedAt: dateOffset(index - 15, 8), sentAt: index % 6 !== 0 ? dateOffset(index - 15, 8) : null, deliveredAt: index % 4 === 0 ? dateOffset(index - 15, 9) : null, failedAt: index % 6 === 0 ? dateOffset(index - 15, 9) : null },
        create: { uuid: seedUuid('crm-communication-business', String(index + 1)), channel: CONTACT_CHANNELS[index % CONTACT_CHANNELS.length], direction: index % 3 === 0 ? 'OUTBOUND' : 'INBOUND', status: index % 6 === 0 ? 'FAILED' : index % 4 === 0 ? 'DELIVERED' : 'SENT', contactId: contact.id, leadId: lead?.id, activityId: activity.id, templateId: template?.id, providerName: 'seed-provider', providerMessageId: `seed-message-${index + 1}`, providerError: index % 6 === 0 ? 'Simulated provider timeout.' : null, destination: email, subject: `Estate Pro update #${index + 1}`, body: 'Deterministic communication fixture.', idempotencyKey: `crm-communication-seed-${index + 1}`, queuedAt: dateOffset(index - 15, 8), sentAt: index % 6 !== 0 ? dateOffset(index - 15, 8) : null, deliveredAt: index % 4 === 0 ? dateOffset(index - 15, 9) : null, failedAt: index % 6 === 0 ? dateOffset(index - 15, 9) : null },
      });
    }
  }
}

async function seedSalesTransactions(tx: SeedTransaction): Promise<void> {
  const pipeline = await tx.salesPipeline.findFirstOrThrow({ orderBy: { id: 'asc' } });
  const stages = await tx.salesPipelineStage.findMany({ where: { pipelineUuid: pipeline.uuid }, orderBy: { sortOrder: 'asc' } });
  const leads = await tx.crmLead.findMany({ orderBy: { id: 'asc' }, take: 20 });
  const properties = await tx.property.findMany({ orderBy: { id: 'asc' }, take: 20, select: { uuid: true } });
  const lostReasons = await tx.salesLostReason.findMany({ orderBy: { id: 'asc' } });
  const commissionRule = await tx.salesCommissionRule.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' } });
  const agents = [...USER_UUIDS];
  if (stages.length < 5 || leads.length < 10 || properties.length < 10) throw new Error('Sales business fixture dependencies are insufficient');

  for (let index = 0; index < 20; index += 1) {
    const lead = leads[index % leads.length];
    const property = properties[index % properties.length];
    const stage = stages[index % stages.length];
    const ownerUserUuid = agents[index % agents.length];
    const opportunityUuid = seedUuid('sales-opportunity-business', String(index + 1));
    const status = stage.code === 'LOST' ? 'LOST' : stage.code === 'WON' ? 'WON' : 'OPEN';
    const opportunity = await tx.salesOpportunity.upsert({
      where: { leadUuid: lead.uuid },
      update: { uuid: opportunityUuid, contactUuid: seedUuid('crm-contact', `business-${String(index + 1).padStart(2, '0')}`), ownerUserUuid, pipelineUuid: pipeline.uuid, stageUuid: stage.uuid, propertyUuid: property.uuid, lostReasonUuid: stage.code === 'LOST' ? lostReasons[index % lostReasons.length]?.uuid : null, title: `Opportunity ${index + 1} — ${property.uuid.slice(0, 8)}`, valueAmount: String(1_800_000_000 + index * 175_000_000), currency: 'IDR', status, version: 1, idempotencyKey: `seed-sales-opportunity-${index + 1}` },
      create: { uuid: opportunityUuid, leadUuid: lead.uuid, contactUuid: seedUuid('crm-contact', `business-${String(index + 1).padStart(2, '0')}`), ownerUserUuid, pipelineUuid: pipeline.uuid, stageUuid: stage.uuid, propertyUuid: property.uuid, lostReasonUuid: stage.code === 'LOST' ? lostReasons[index % lostReasons.length]?.uuid : null, title: `Opportunity ${index + 1} — ${property.uuid.slice(0, 8)}`, valueAmount: String(1_800_000_000 + index * 175_000_000), currency: 'IDR', status, version: 1, idempotencyKey: `seed-sales-opportunity-${index + 1}` },
    });
    await tx.salesOpportunityStageHistory.deleteMany({ where: { opportunityUuid: opportunity.uuid } });
    await tx.salesOpportunityStageHistory.create({ data: { uuid: seedUuid('sales-stage-history-business', String(index + 1)), opportunityUuid: opportunity.uuid, fromStageUuid: stages[Math.max(0, (index - 1) % stages.length)]?.uuid, toStageUuid: stage.uuid, fromStatus: 'OPEN', toStatus: status, actorUserUuid: ownerUserUuid, reason: `Seed lifecycle transition to ${stage.code}.`, occurredAt: dateOffset(index - 20) } });

    const negotiation = await tx.salesNegotiation.upsert({ where: { uuid: seedUuid('sales-negotiation-business', String(index + 1)) }, update: { opportunityUuid: opportunity.uuid, openedByUuid: ownerUserUuid, status: stage.code === 'WON' ? 'CLOSED' : stage.code === 'LOST' ? 'CANCELLED' : 'OPEN', notes: `Negotiation scenario ${index + 1}.`, version: 1 }, create: { uuid: seedUuid('sales-negotiation-business', String(index + 1)), opportunityUuid: opportunity.uuid, openedByUuid: ownerUserUuid, status: stage.code === 'WON' ? 'CLOSED' : stage.code === 'LOST' ? 'CANCELLED' : 'OPEN', notes: `Negotiation scenario ${index + 1}.`, version: 1 } });
    await tx.salesNegotiationHistory.deleteMany({ where: { negotiationUuid: negotiation.uuid } });
    await tx.salesNegotiationHistory.create({ data: { uuid: seedUuid('sales-negotiation-history-business', String(index + 1)), negotiationUuid: negotiation.uuid, fromStatus: 'OPEN', toStatus: stage.code === 'WON' ? 'CLOSED' : stage.code === 'LOST' ? 'CANCELLED' : 'OPEN', actorUserUuid: ownerUserUuid, occurredAt: dateOffset(index - 18) } });
    const offer = await tx.salesOffer.upsert({ where: { negotiationUuid_version: { negotiationUuid: negotiation.uuid, version: 1 } }, update: { amount: String(1_700_000_000 + index * 160_000_000), currency: 'IDR', status: stage.code === 'WON' ? 'ACCEPTED' : stage.code === 'LOST' ? 'REJECTED' : 'DRAFT', expiresAt: dateOffset(index + 15), actorUserUuid: ownerUserUuid }, create: { uuid: seedUuid('sales-offer-business', `${index + 1}:1`), negotiationUuid: negotiation.uuid, version: 1, amount: String(1_700_000_000 + index * 160_000_000), currency: 'IDR', status: stage.code === 'WON' ? 'ACCEPTED' : stage.code === 'LOST' ? 'REJECTED' : 'DRAFT', expiresAt: dateOffset(index + 15), actorUserUuid: ownerUserUuid } });

    await tx.salesActivity.upsert({ where: { uuid: seedUuid('sales-activity-business', String(index + 1)) }, update: { opportunityUuid: opportunity.uuid, actorUserUuid: ownerUserUuid, type: ACTIVITY_TYPES[index % ACTIVITY_TYPES.length], status: stage.code === 'WON' || stage.code === 'LOST' ? 'COMPLETED' : 'OPEN', subject: `Sales follow-up #${index + 1}`, body: 'Deterministic sales pipeline activity.', dueAt: dateOffset(index - 10, 10), completedAt: stage.code === 'WON' || stage.code === 'LOST' ? dateOffset(index - 9, 11) : null }, create: { uuid: seedUuid('sales-activity-business', String(index + 1)), opportunityUuid: opportunity.uuid, actorUserUuid: ownerUserUuid, type: ACTIVITY_TYPES[index % ACTIVITY_TYPES.length], status: stage.code === 'WON' || stage.code === 'LOST' ? 'COMPLETED' : 'OPEN', subject: `Sales follow-up #${index + 1}`, body: 'Deterministic sales pipeline activity.', dueAt: dateOffset(index - 10, 10), completedAt: stage.code === 'WON' || stage.code === 'LOST' ? dateOffset(index - 9, 11) : null } });
    await tx.salesViewing.upsert({ where: { uuid: seedUuid('sales-viewing-business', String(index + 1)) }, update: { opportunityUuid: opportunity.uuid, propertyUuid: property.uuid, contactUuid: opportunity.contactUuid, scheduledAt: dateOffset(index - 5, 13), status: index % 4 === 0 ? 'COMPLETED' : index % 5 === 0 ? 'CANCELLED' : 'REQUESTED', notes: `Viewing scenario ${index + 1}.`, actorUserUuid: ownerUserUuid }, create: { uuid: seedUuid('sales-viewing-business', String(index + 1)), opportunityUuid: opportunity.uuid, propertyUuid: property.uuid, contactUuid: opportunity.contactUuid, scheduledAt: dateOffset(index - 5, 13), status: index % 4 === 0 ? 'COMPLETED' : index % 5 === 0 ? 'CANCELLED' : 'REQUESTED', notes: `Viewing scenario ${index + 1}.`, actorUserUuid: ownerUserUuid } });

    if (stage.code === 'WON') {
      const deal = await tx.salesDeal.upsert({ where: { opportunityUuid: opportunity.uuid }, update: { offerUuid: offer.uuid, status: 'WON', ownerUserUuid, currency: 'IDR', totalAmount: String(1_700_000_000 + index * 160_000_000), version: 1, idempotencyKey: `seed-sales-deal-${index + 1}` }, create: { uuid: seedUuid('sales-deal-business', String(index + 1)), opportunityUuid: opportunity.uuid, offerUuid: offer.uuid, status: 'WON', ownerUserUuid, currency: 'IDR', totalAmount: String(1_700_000_000 + index * 160_000_000), version: 1, idempotencyKey: `seed-sales-deal-${index + 1}` } });
      await tx.salesDealItem.upsert({ where: { uuid: seedUuid('sales-deal-item-business', String(index + 1)) }, update: { dealUuid: deal.uuid, propertyUuid: property.uuid, description: `Property purchase #${index + 1}`, quantity: 1, unitAmount: String(1_700_000_000 + index * 160_000_000), lineAmount: String(1_700_000_000 + index * 160_000_000), currency: 'IDR' }, create: { uuid: seedUuid('sales-deal-item-business', String(index + 1)), dealUuid: deal.uuid, propertyUuid: property.uuid, description: `Property purchase #${index + 1}`, quantity: 1, unitAmount: String(1_700_000_000 + index * 160_000_000), lineAmount: String(1_700_000_000 + index * 160_000_000), currency: 'IDR' } });
      await tx.salesClosing.upsert({ where: { dealUuid: deal.uuid }, update: { method: 'BANK_TRANSFER', closedAt: dateOffset(index - 2, 15), actorUserUuid: ownerUserUuid, idempotencyKey: `seed-sales-closing-${index + 1}` }, create: { uuid: seedUuid('sales-closing-business', String(index + 1)), dealUuid: deal.uuid, method: 'BANK_TRANSFER', closedAt: dateOffset(index - 2, 15), actorUserUuid: ownerUserUuid, idempotencyKey: `seed-sales-closing-${index + 1}` } });
      const baseAmount = 1_700_000_000 + index * 160_000_000;
      await tx.salesCommission.upsert({ where: { dealUuid: deal.uuid }, update: { ruleUuid: commissionRule.uuid, baseAmount: String(baseAmount), ratePercent: commissionRule.ratePercent, amount: String(baseAmount * 0.025), currency: 'IDR', status: index % 3 === 0 ? 'SETTLED' : index % 3 === 1 ? 'APPROVED' : 'PENDING', calculatedAt: dateOffset(index - 1, 16), approvedAt: index % 3 !== 2 ? dateOffset(index, 9) : null, settledAt: index % 3 === 0 ? dateOffset(index + 1, 9) : null, idempotencyKey: `seed-sales-commission-${index + 1}` }, create: { uuid: seedUuid('sales-commission-business', String(index + 1)), dealUuid: deal.uuid, ruleUuid: commissionRule.uuid, baseAmount: String(baseAmount), ratePercent: commissionRule.ratePercent, amount: String(baseAmount * 0.025), currency: 'IDR', status: index % 3 === 0 ? 'SETTLED' : index % 3 === 1 ? 'APPROVED' : 'PENDING', calculatedAt: dateOffset(index - 1, 16), approvedAt: index % 3 !== 2 ? dateOffset(index, 9) : null, settledAt: index % 3 === 0 ? dateOffset(index + 1, 9) : null, idempotencyKey: `seed-sales-commission-${index + 1}` } });
    }
  }
}

export async function seedBusinessScenarios(tx: SeedTransaction): Promise<void> {
  await seedContactsAndLeads(tx);
  await seedCrmActivitiesAndCommunications(tx);
  await seedSalesTransactions(tx);
}
