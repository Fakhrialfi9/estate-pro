import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  pageOf,
  duplicatePairKey,
  normalizeEmail,
  normalizePhone,
  toText,
  type PageQuery,
  type CrmActor,
} from '../../domain/crm.types.js';
import type { CrmRepository } from '../../domain/repositories/crm.repository.js';

type Row = Record<string, unknown>;
const asRow = (v: unknown): Row =>
  v && typeof v === 'object' ? (v as Row) : {};
const pageResult = (
  items: readonly unknown[],
  total: number,
  query: PageQuery,
) => {
  const p = pageOf(query);
  return { items, total, page: p.page, limit: p.limit };
};
const delegateName: Record<string, string> = {
  source: 'crmLeadSource',
  campaign: 'crmLeadCampaign',
  type: 'crmLeadType',
  status: 'crmLeadStatus',
  tag: 'crmLeadTag',
};
@Injectable()
export class PrismaCrmRepository implements CrmRepository {
  constructor(private readonly prisma: PrismaService) {}
  private requireUuid(value: unknown): string {
    if (typeof value !== 'string' || !value)
      throw new Error('Invalid identifier');
    return value;
  }
  async createContact(input: Row) {
    return this.prisma.crmContact.create({
      data: {
        uuid: randomUUID(),
        firstName: toText(input.firstName),
        lastName: input.lastName == null ? null : toText(input.lastName),
        displayName: toText(input.displayName),
        companyName: input.companyName ? toText(input.companyName) : null,
        jobTitle: input.jobTitle ? toText(input.jobTitle) : null,
        status: 'ACTIVE',
        ownerUserUuid: input.ownerUserUuid ? toText(input.ownerUserUuid) : null,
        source: input.source ? toText(input.source) : null,
      },
    });
  }
  async getContact(uuid: string) {
    const r = await this.prisma.crmContact.findFirst({
      where: { uuid, archivedAt: null },
      include: {
        addresses: true,
        phones: true,
        emails: true,
        preferences: true,
        consents: { orderBy: { createdAt: 'desc' } },
        relationshipsFrom: {
          include: { toContact: { select: { uuid: true, displayName: true } } },
        },
        relationshipsTo: {
          include: {
            fromContact: { select: { uuid: true, displayName: true } },
          },
        },
      },
    });
    if (!r) throw new Error('Contact not found');
    return r;
  }
  async listContacts(q: PageQuery) {
    const p = pageOf(q);
    const where: Row = { archivedAt: null };
    if (q.search) {
      where.OR = [
        { displayName: { contains: q.search } },
        { companyName: { contains: q.search } },
        { firstName: { contains: q.search } },
        { lastName: { contains: q.search } },
      ];
    }
    const allowed = new Set(['createdAt', 'displayName', 'updatedAt']);
    const sort = allowed.has(q.sortBy ?? '') ? q.sortBy : 'createdAt';
    const dir = q.sortDirection === 'asc' ? 'asc' : 'desc';
    const [items, total] = await Promise.all([
      this.prisma.crmContact.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: [{ [sort as string]: dir }, { uuid: 'asc' }],
      }),
      this.prisma.crmContact.count({ where }),
    ]);
    return pageResult(items, total, q);
  }
  async updateContact(uuid: string, input: Row) {
    const current = await this.prisma.crmContact.findFirst({
      where: { uuid, archivedAt: null },
    });
    if (!current) throw new Error('Contact not found');
    return this.prisma.crmContact.update({
      where: { id: current.id },
      data: {
        ...(input.firstName !== undefined
          ? { firstName: toText(input.firstName) }
          : {}),
        ...(input.lastName !== undefined
          ? { lastName: input.lastName == null ? null : toText(input.lastName) }
          : {}),
        ...(input.displayName !== undefined
          ? { displayName: toText(input.displayName) }
          : {}),
        ...(input.companyName !== undefined
          ? {
              companyName:
                input.companyName == null ? null : toText(input.companyName),
            }
          : {}),
        ...(input.jobTitle !== undefined
          ? { jobTitle: input.jobTitle == null ? null : toText(input.jobTitle) }
          : {}),
      },
    });
  }
  async archiveContact(uuid: string) {
    const r = await this.prisma.crmContact.findFirst({
      where: { uuid, archivedAt: null },
    });
    if (!r) throw new Error('Contact not found');
    await this.prisma.crmContact.update({
      where: { id: r.id },
      data: { archivedAt: new Date(), status: 'ARCHIVED' },
    });
  }
  private async contactId(uuid: string) {
    const r = await this.prisma.crmContact.findFirst({
      where: { uuid, archivedAt: null },
      select: { id: true },
    });
    if (!r) throw new Error('Contact not found');
    return r.id;
  }
  async addContactAddress(c: string, i: Row) {
    const id = await this.contactId(c);
    return this.prisma.$transaction(async (tx) => {
      if (i.isPrimary === true)
        await tx.crmContactAddress.updateMany({
          where: { contactId: id },
          data: { isPrimary: false },
        });
      return tx.crmContactAddress.create({
        data: {
          uuid: randomUUID(),
          contactId: id,
          type: toText(i.type),
          line1: toText(i.line1),
          line2: i.line2 ? toText(i.line2) : null,
          city: toText(i.city),
          region: i.region ? toText(i.region) : null,
          postalCode: i.postalCode ? toText(i.postalCode) : null,
          countryCode: toText(i.countryCode).toUpperCase(),
          isPrimary: i.isPrimary === true,
        },
      });
    });
  }
  async addContactPhone(c: string, i: Row) {
    const id = await this.contactId(c);
    const normalized = normalizePhone(toText(i.value));
    return this.prisma.$transaction(async (tx) => {
      if (i.isPrimary === true)
        await tx.crmContactPhone.updateMany({
          where: { contactId: id },
          data: { isPrimary: false },
        });
      return tx.crmContactPhone.create({
        data: {
          uuid: randomUUID(),
          contactId: id,
          type: toText(i.type),
          value: toText(i.value),
          normalizedValue: normalized,
          isPrimary: i.isPrimary === true,
          isVerified: false,
        },
      });
    });
  }
  async addContactEmail(c: string, i: Row) {
    const id = await this.contactId(c);
    const normalized = normalizeEmail(toText(i.value));
    return this.prisma.$transaction(async (tx) => {
      if (i.isPrimary === true)
        await tx.crmContactEmail.updateMany({
          where: { contactId: id },
          data: { isPrimary: false },
        });
      return tx.crmContactEmail.create({
        data: {
          uuid: randomUUID(),
          contactId: id,
          type: toText(i.type),
          value: toText(i.value),
          normalizedValue: normalized,
          isPrimary: i.isPrimary === true,
          isVerified: false,
        },
      });
    });
  }
  async updateContactChild(
    kind: string,
    contactUuid: string,
    uuid: string,
    i: Row,
  ) {
    const id = await this.contactId(contactUuid);
    if (kind === 'email') {
      const current = await this.prisma.crmContactEmail.findFirst({
        where: { uuid, contactId: id },
      });
      if (!current) throw new Error('Contact email not found');
      return this.prisma.crmContactEmail.update({
        where: { id: current.id },
        data: {
          ...(i.value !== undefined
            ? {
                value: toText(i.value),
                normalizedValue: normalizeEmail(toText(i.value)),
              }
            : {}),
          ...(i.type !== undefined ? { type: toText(i.type) } : {}),
        },
      });
    }
    if (kind === 'phone') {
      const current = await this.prisma.crmContactPhone.findFirst({
        where: { uuid, contactId: id },
      });
      if (!current) throw new Error('Contact phone not found');
      return this.prisma.crmContactPhone.update({
        where: { id: current.id },
        data: {
          ...(i.value !== undefined
            ? {
                value: toText(i.value),
                normalizedValue: normalizePhone(toText(i.value)),
              }
            : {}),
          ...(i.type !== undefined ? { type: toText(i.type) } : {}),
        },
      });
    }
    const current = await this.prisma.crmContactAddress.findFirst({
      where: { uuid, contactId: id },
    });
    if (!current) throw new Error('Contact address not found');
    return this.prisma.crmContactAddress.update({
      where: { id: current.id },
      data: {
        ...(i.line1 !== undefined ? { line1: toText(i.line1) } : {}),
        ...(i.line2 !== undefined
          ? { line2: i.line2 == null ? null : toText(i.line2) }
          : {}),
        ...(i.city !== undefined ? { city: toText(i.city) } : {}),
        ...(i.region !== undefined
          ? { region: i.region == null ? null : toText(i.region) }
          : {}),
        ...(i.postalCode !== undefined
          ? { postalCode: i.postalCode == null ? null : toText(i.postalCode) }
          : {}),
      },
    });
  }
  async deleteContactChild(kind: string, contactUuid: string, uuid: string) {
    const id = await this.contactId(contactUuid);
    if (kind === 'email') {
      const current = await this.prisma.crmContactEmail.findFirst({
        where: { uuid, contactId: id },
      });
      if (!current) throw new Error('Contact email not found');
      await this.prisma.crmContactEmail.delete({ where: { id: current.id } });
    } else if (kind === 'phone') {
      const current = await this.prisma.crmContactPhone.findFirst({
        where: { uuid, contactId: id },
      });
      if (!current) throw new Error('Contact phone not found');
      await this.prisma.crmContactPhone.delete({ where: { id: current.id } });
    } else {
      const current = await this.prisma.crmContactAddress.findFirst({
        where: { uuid, contactId: id },
      });
      if (!current) throw new Error('Contact address not found');
      await this.prisma.crmContactAddress.delete({ where: { id: current.id } });
    }
  }
  async setContactPrimary(kind: string, c: string, uuid: string) {
    const id = await this.contactId(c);
    return this.prisma.$transaction(async (tx) => {
      if (kind === 'email') {
        const current = await tx.crmContactEmail.findFirst({
          where: { uuid, contactId: id },
        });
        if (!current) throw new Error('Contact email not found');
        await tx.crmContactEmail.updateMany({
          where: { contactId: id },
          data: { isPrimary: false },
        });
        return tx.crmContactEmail.update({
          where: { id: current.id },
          data: { isPrimary: true },
        });
      }
      if (kind === 'phone') {
        const current = await tx.crmContactPhone.findFirst({
          where: { uuid, contactId: id },
        });
        if (!current) throw new Error('Contact phone not found');
        await tx.crmContactPhone.updateMany({
          where: { contactId: id },
          data: { isPrimary: false },
        });
        return tx.crmContactPhone.update({
          where: { id: current.id },
          data: { isPrimary: true },
        });
      }
      const current = await tx.crmContactAddress.findFirst({
        where: { uuid, contactId: id },
      });
      if (!current) throw new Error('Contact address not found');
      await tx.crmContactAddress.updateMany({
        where: { contactId: id },
        data: { isPrimary: false },
      });
      return tx.crmContactAddress.update({
        where: { id: current.id },
        data: { isPrimary: true },
      });
    });
  }
  async upsertPreferences(c: string, i: Row) {
    const id = await this.contactId(c);
    return this.prisma.crmContactPreference.upsert({
      where: { contactId: id },
      create: {
        uuid: randomUUID(),
        contactId: id,
        preferredChannel: toText(i.preferredChannel ?? 'EMAIL'),
        preferredLanguage: i.preferredLanguage
          ? toText(i.preferredLanguage)
          : null,
        marketingEmail: i.marketingEmail === true,
        marketingSms: i.marketingSms === true,
        marketingWhatsapp: i.marketingWhatsapp === true,
        quietHoursStart: i.quietHoursStart ? toText(i.quietHoursStart) : null,
        quietHoursEnd: i.quietHoursEnd ? toText(i.quietHoursEnd) : null,
        timezone: toText(i.timezone ?? 'UTC'),
      },
      update: {
        preferredChannel: toText(i.preferredChannel ?? 'EMAIL'),
        preferredLanguage: i.preferredLanguage
          ? toText(i.preferredLanguage)
          : null,
        marketingEmail: i.marketingEmail === true,
        marketingSms: i.marketingSms === true,
        marketingWhatsapp: i.marketingWhatsapp === true,
        quietHoursStart: i.quietHoursStart ? toText(i.quietHoursStart) : null,
        quietHoursEnd: i.quietHoursEnd ? toText(i.quietHoursEnd) : null,
        timezone: toText(i.timezone ?? 'UTC'),
      },
    });
  }
  async addConsent(c: string, i: Row, a: CrmActor) {
    const id = await this.contactId(c);
    const now = new Date();
    return this.prisma.crmContactConsent.create({
      data: {
        uuid: randomUUID(),
        contactId: id,
        consentType: toText(i.consentType),
        status: toText(i.status),
        source: toText(i.source),
        grantedAt: toText(i.status) === 'GRANTED' ? now : null,
        revokedAt: toText(i.status) === 'REVOKED' ? now : null,
        actorUserUuid: a.actorUuid,
      },
    });
  }
  async relationship(c: string, t: string, i: Row) {
    const [from, to] = await Promise.all([
      this.contactId(c),
      this.contactId(t),
    ]);
    if (from === to) throw new Error('A contact cannot relate to itself');
    return this.prisma.crmContactRelationship.create({
      data: {
        uuid: randomUUID(),
        fromContactId: from,
        toContactId: to,
        relationshipType: toText(i.relationshipType),
        isReciprocal: i.isReciprocal === true,
      },
    });
  }
  async removeRelationship(uuid: string) {
    await this.prisma.crmContactRelationship.delete({ where: { uuid } });
  }
  private async leadId(uuid: string) {
    const r = await this.prisma.crmLead.findFirst({
      where: { uuid, archivedAt: null },
      select: { id: true },
    });
    if (!r) throw new Error('Lead not found');
    return r.id;
  }
  async createLead(i: Row, a: CrmActor) {
    const [contact, source, type, status, campaign] = await Promise.all([
      this.prisma.crmContact.findFirst({
        where: { uuid: toText(i.contactUuid), archivedAt: null },
        select: { id: true },
      }),
      this.prisma.crmLeadSource.findFirst({
        where: { uuid: toText(i.sourceUuid), deletedAt: null, isActive: true },
        select: { id: true },
      }),
      this.prisma.crmLeadType.findFirst({
        where: { uuid: toText(i.typeUuid), deletedAt: null, isActive: true },
        select: { id: true },
      }),
      i.statusUuid
        ? this.prisma.crmLeadStatus.findFirst({
            where: {
              uuid: toText(i.statusUuid),
              deletedAt: null,
              isActive: true,
            },
            select: { id: true, code: true },
          })
        : this.prisma.crmLeadStatus.findFirst({
            where: { code: 'NEW', deletedAt: null, isActive: true },
            select: { id: true, code: true },
          }),
      i.campaignUuid
        ? this.prisma.crmLeadCampaign.findFirst({
            where: {
              uuid: toText(i.campaignUuid),
              deletedAt: null,
              isActive: true,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!contact || !source || !type || !status)
      throw new Error('Invalid lead reference');
    const code = toText(
      i.code ?? `LEAD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    );
    const lead = await this.prisma.crmLead.create({
      data: {
        uuid: randomUUID(),
        code,
        contactId: contact.id,
        sourceId: source.id,
        typeId: type.id,
        statusId: status.id,
        campaignId: campaign?.id ?? null,
        ownerUserUuid: null,
        score: 0,
      },
    });
    await this.prisma.crmLeadHistory.create({
      data: {
        uuid: randomUUID(),
        leadId: lead.id,
        eventType: 'CREATED',
        toValue: status.code,
        actorUserUuid: a.actorUuid,
        summary: 'Lead created',
      },
    });
    return lead;
  }
  async getLead(uuid: string) {
    const r = await this.prisma.crmLead.findFirst({
      where: { uuid, archivedAt: null },
      include: {
        contact: { select: { uuid: true, displayName: true } },
        source: { select: { uuid: true, code: true, name: true } },
        campaign: { select: { uuid: true, code: true, name: true } },
        type: { select: { uuid: true, code: true, name: true } },
        status: {
          select: { uuid: true, code: true, name: true, isClosed: true },
        },
        tags: {
          include: { tag: { select: { uuid: true, code: true, name: true } } },
        },
        notes: { orderBy: { createdAt: 'desc' } },
        assignments: { orderBy: { assignedAt: 'desc' } },
        history: { orderBy: { createdAt: 'desc' } },
        scoreEntries: { orderBy: { calculatedAt: 'desc' } },
      },
    });
    if (!r) throw new Error('Lead not found');
    return r;
  }
  async listLeads(q: PageQuery & Row) {
    const p = pageOf(q);
    const where: Row = { archivedAt: null };
    for (const key of ['ownerUserUuid'])
      if (q[key]) where[key] = toText(q[key]);
    if (q.statusUuid) where.status = { uuid: toText(q.statusUuid) };
    if (q.sourceUuid) where.source = { uuid: toText(q.sourceUuid) };
    if (q.typeUuid) where.type = { uuid: toText(q.typeUuid) };
    if (q.search)
      where.OR = [
        { code: { contains: q.search } },
        { contact: { displayName: { contains: q.search } } },
      ];
    const allowed = new Set(['createdAt', 'updatedAt', 'score', 'code']);
    const sort = allowed.has(q.sortBy ?? '') ? q.sortBy : 'createdAt';
    const dir = q.sortDirection === 'asc' ? 'asc' : 'desc';
    const [items, total] = await Promise.all([
      this.prisma.crmLead.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: [{ [sort as string]: dir }, { uuid: 'asc' }],
        include: {
          contact: { select: { uuid: true, displayName: true } },
          status: { select: { uuid: true, code: true, name: true } },
          source: { select: { uuid: true, code: true, name: true } },
          type: { select: { uuid: true, code: true, name: true } },
        },
      }),
      this.prisma.crmLead.count({ where }),
    ]);
    return pageResult(items, total, q);
  }
  async updateLead(uuid: string, i: Row) {
    const id = await this.leadId(uuid);
    return this.prisma.crmLead.update({
      where: { id },
      data: {
        ...(i.code !== undefined ? { code: toText(i.code) } : {}),
        ...(i.campaignUuid !== undefined
          ? {
              campaignId: i.campaignUuid
                ? (await this.prisma.crmLeadCampaign.findFirst({
                    where: { uuid: toText(i.campaignUuid) },
                    select: { id: true },
                  }))?.id ?? null
                : null,
            }
          : {}),
      },
    });
  }
  async archiveLead(uuid: string) {
    const id = await this.leadId(uuid);
    await this.prisma.crmLead.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        statusId: await this.prisma.crmLeadStatus
          .findFirstOrThrow({ where: { code: 'ARCHIVED' } })
          .then((s) => s.id),
      },
    });
  }
  async changeLeadStatus(uuid: string, statusUuid: string, a: CrmActor) {
    const id = await this.leadId(uuid);
    return this.prisma.$transaction(async (tx) => {
      const [lead, status] = await Promise.all([
        tx.crmLead.findUnique({ where: { id }, include: { status: true } }),
        tx.crmLeadStatus.findFirst({
          where: { uuid: statusUuid, isActive: true, deletedAt: null },
        }),
      ]);
      if (!lead || !status) throw new Error('Lead or status not found');
      if (lead.statusId !== status.id) {
        const allowed = await tx.crmLeadStatusTransition.findFirst({
          where: { fromStatusId: lead.statusId, toStatusId: status.id },
        });
        if (!allowed)
          throw new Error(
            `Invalid lead status transition: ${lead.status.code} -> ${status.code}`,
          );
      }
      const updated = await tx.crmLead.update({
        where: { id },
        data: {
          statusId: status.id,
          qualifiedAt:
            status.code === 'QUALIFIED' ? new Date() : lead.qualifiedAt,
          closedAt: status.isClosed ? new Date() : null,
          archivedAt: status.code === 'ARCHIVED' ? new Date() : lead.archivedAt,
        },
      });
      await tx.crmLeadHistory.create({
        data: {
          uuid: randomUUID(),
          leadId: id,
          eventType: 'STATUS_CHANGED',
          fromValue: lead.status.code,
          toValue: status.code,
          actorUserUuid: a.actorUuid,
        },
      });
      return updated;
    });
  }
  async assignLead(uuid: string, userUuid: string, a: CrmActor) {
    const id = await this.leadId(uuid);
    return this.prisma.$transaction(async (tx) => {
      await tx.crmLeadAssignment.updateMany({
        where: { leadId: id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      const r = await tx.crmLeadAssignment.create({
        data: {
          uuid: randomUUID(),
          leadId: id,
          assigneeUserUuid: userUuid,
          assignedByUserUuid: a.actorUuid,
        },
      });
      await tx.crmLead.update({
        where: { id },
        data: { ownerUserUuid: userUuid },
      });
      await tx.crmLeadHistory.create({
        data: {
          uuid: randomUUID(),
          leadId: id,
          eventType: 'ASSIGNED',
          toValue: userUuid,
          actorUserUuid: a.actorUuid,
        },
      });
      return r;
    });
  }
  async unassignLead(uuid: string, a: CrmActor) {
    const id = await this.leadId(uuid);
    await this.prisma.$transaction(async (tx) => {
      await tx.crmLeadAssignment.updateMany({
        where: { leadId: id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      await tx.crmLead.update({ where: { id }, data: { ownerUserUuid: null } });
      await tx.crmLeadHistory.create({
        data: {
          uuid: randomUUID(),
          leadId: id,
          eventType: 'UNASSIGNED',
          actorUserUuid: a.actorUuid,
        },
      });
    });
    return { uuid };
  }
  async addLeadNote(uuid: string, body: string, a: CrmActor) {
    const id = await this.leadId(uuid);
    return this.prisma.crmLeadNote.create({
      data: {
        uuid: randomUUID(),
        leadId: id,
        authorUserUuid: a.actorUuid,
        body,
      },
    });
  }
  async tagLead(uuid: string, tagUuid: string) {
    const [lead, tag] = await Promise.all([
      this.leadId(uuid),
      this.prisma.crmLeadTag.findFirst({
        where: { uuid: tagUuid, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!tag) throw new Error('Tag not found');
    return this.prisma.crmLeadTagLink.upsert({
      where: { leadId_tagId: { leadId: lead, tagId: tag.id } },
      create: { leadId: lead, tagId: tag.id },
      update: {},
    });
  }
  async untagLead(uuid: string, tagUuid: string) {
    const id = await this.leadId(uuid);
    const tag = await this.prisma.crmLeadTag.findFirst({
      where: { uuid: tagUuid },
      select: { id: true },
    });
    if (tag)
      await this.prisma.crmLeadTagLink.deleteMany({
        where: { leadId: id, tagId: tag.id },
      });
  }
  async listLeadHistory(uuid: string, q: PageQuery) {
    const p = pageOf(q);
    const id = await this.leadId(uuid);
    const [items, total] = await Promise.all([
      this.prisma.crmLeadHistory.findMany({
        where: { leadId: id },
        skip: p.skip,
        take: p.limit,
        orderBy: [{ createdAt: 'desc' }, { uuid: 'asc' }],
      }),
      this.prisma.crmLeadHistory.count({ where: { leadId: id } }),
    ]);
    return pageResult(items, total, q);
  }
  async getLeadScore(uuid: string) {
    const id = await this.leadId(uuid);
    const factors = await this.prisma.crmLeadScore.findMany({
      where: { leadId: id },
      orderBy: { calculatedAt: 'desc' },
    });
    const lead = await this.prisma.crmLead.findUnique({
      where: { id },
      select: { score: true, scoreVersion: true },
    });
    return {
      score: lead?.score ?? 0,
      scoreVersion: lead?.scoreVersion ?? 1,
      factors,
    };
  }
  async saveScore(
    uuid: string,
    score: number,
    factors: readonly { code: string; points: number; explanation: string }[],
  ) {
    const id = await this.leadId(uuid);
    return this.prisma.$transaction(async (tx) => {
      await tx.crmLeadScore.deleteMany({ where: { leadId: id } });
      await tx.crmLeadScore.createMany({
        data: factors.map((f) => ({
          uuid: randomUUID(),
          leadId: id,
          ruleCode: f.code,
          points: f.points,
          explanation: f.explanation,
        })),
      });
      return tx.crmLead.update({
        where: { id },
        data: { score, scoreVersion: { increment: 1 } },
      });
    });
  }
  async listScoreRules() {
    return this.prisma.crmLeadScoreRule.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { code: 'asc' }],
    });
  }
  async createScoreRule(i: Row) {
    return this.prisma.crmLeadScoreRule.create({
      data: {
        uuid: randomUUID(),
        code: toText(i.code),
        field: toText(i.field),
        operator: toText(i.operator),
        value: toText(i.value),
        points: Number(i.points),
        priority: Number(i.priority ?? 0),
      },
    });
  }
  async updateScoreRule(uuid: string, i: Row) {
    const r = await this.prisma.crmLeadScoreRule.findFirst({ where: { uuid } });
    if (!r) throw new Error('Score rule not found');
    return this.prisma.crmLeadScoreRule.update({
      where: { id: r.id },
      data: {
        ...(i.field !== undefined ? { field: toText(i.field) } : {}),
        ...(i.operator !== undefined ? { operator: toText(i.operator) } : {}),
        ...(i.value !== undefined ? { value: toText(i.value) } : {}),
        ...(i.points !== undefined ? { points: Number(i.points) } : {}),
        ...(i.priority !== undefined ? { priority: Number(i.priority) } : {}),
        ...(i.isActive !== undefined ? { isActive: i.isActive === true } : {}),
        version: { increment: 1 },
      },
    });
  }
  async deleteScoreRule(uuid: string) {
    const r = await this.prisma.crmLeadScoreRule.findFirst({ where: { uuid } });
    if (!r) throw new Error('Score rule not found');
    await this.prisma.crmLeadScoreRule.update({
      where: { id: r.id },
      data: { isActive: false },
    });
  }
  async detectDuplicates(uuid: string) {
    const lead = await this.getLead(uuid);
    const leadRow = asRow(lead);
    const c = asRow(leadRow.contact);
    const email = (c.emails as Row[] | undefined)?.find(
      (e) => e.isPrimary === true,
    )?.normalizedValue as string | undefined;
    const phone = (c.phones as Row[] | undefined)?.find(
      (e) => e.isPrimary === true,
    )?.normalizedValue as string | undefined;
    const name = toText(c.displayName ?? '');
    const candidates = await this.prisma.crmLead.findMany({
      where: { archivedAt: null, NOT: { uuid } },
      include: { contact: { include: { emails: true, phones: true } } },
      take: 50,
    });
    const out = [] as unknown[];
    for (const candidate of candidates) {
      const cc = asRow(candidate.contact);
      const ce = (cc.emails as Row[] | undefined)
        ?.map((e) => e.normalizedValue)
        .filter(Boolean) as string[] | undefined;
      const cp = (cc.phones as Row[] | undefined)
        ?.map((e) => e.normalizedValue)
        .filter(Boolean) as string[] | undefined;
      let confidence = 0;
      const signals: string[] = [];
      if (email && ce?.includes(email)) {
        confidence += 60;
        signals.push('EMAIL');
      }
      if (phone && cp?.includes(phone)) {
        confidence += 30;
        signals.push('PHONE');
      }
      if (
        name &&
        toText(cc.displayName ?? '').toLowerCase() === name.toLowerCase()
      ) {
        confidence += 20;
        signals.push('NAME');
      }
      if (confidence >= 40) {
        const pairKey = duplicatePairKey(uuid, candidate.uuid);
        const record = await this.prisma.crmLeadDuplicate.upsert({
          where: { pairKey },
          create: {
            uuid: randomUUID(),
            leadId: BigInt(toText(leadRow.id)),
            candidateLeadId: BigInt(toText((candidate as Row).id)),
            pairKey,
            confidence,
            signals: signals.join(','),
          },
          update: {
            leadId: BigInt(toText(leadRow.id)),
            candidateLeadId: BigInt(toText((candidate as Row).id)),
            confidence,
            signals: signals.join(','),
            status: 'CANDIDATE',
          },
        });
        out.push(record);
      }
    }
    return out;
  }
  async listDuplicates(q: PageQuery) {
    const p = pageOf(q);
    const [items, total] = await Promise.all([
      this.prisma.crmLeadDuplicate.findMany({
        skip: p.skip,
        take: p.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: { select: { uuid: true, code: true } },
          candidateLead: { select: { uuid: true, code: true } },
        },
      }),
      this.prisma.crmLeadDuplicate.count(),
    ]);
    return pageResult(items, total, q);
  }
  async reviewDuplicate(uuid: string, status: string, a: CrmActor) {
    return this.prisma.crmLeadDuplicate.update({
      where: { uuid },
      data: { status, reviewedByUserUuid: a.actorUuid, reviewedAt: new Date() },
    });
  }
  async mergeLeads(sourceUuid: string, targetUuid: string, a: CrmActor) {
    if (sourceUuid === targetUuid)
      throw new Error('Cannot merge a lead into itself');
    return this.prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.crmLead.findFirst({ where: { uuid: sourceUuid, archivedAt: null } }),
        tx.crmLead.findFirst({ where: { uuid: targetUuid, archivedAt: null } }),
      ]);
      if (!source || !target) throw new Error('Lead not found');
      const sourceTags = await tx.crmLeadTagLink.findMany({
        where: { leadId: source.id },
        select: { tagId: true },
      });
      const targetTags = await tx.crmLeadTagLink.findMany({
        where: { leadId: target.id },
        select: { tagId: true },
      });
      const targetTagIds = new Set(
        targetTags.map((tag) => tag.tagId.toString()),
      );
      const tagsToCreate = sourceTags
        .filter((tag) => !targetTagIds.has(tag.tagId.toString()))
        .map((tag) => ({ leadId: target.id, tagId: tag.tagId }));
      if (tagsToCreate.length)
        await tx.crmLeadTagLink.createMany({ data: tagsToCreate });
      await tx.crmLeadTagLink.deleteMany({ where: { leadId: source.id } });
      await tx.crmLeadNote.updateMany({
        where: { leadId: source.id },
        data: { leadId: target.id },
      });
      await tx.crmLeadHistory.updateMany({
        where: { leadId: source.id },
        data: { leadId: target.id },
      });
      await tx.crmLeadAssignment.updateMany({
        where: { leadId: source.id },
        data: { leadId: target.id },
      });
      await tx.crmActivity.updateMany({
        where: { leadId: source.id },
        data: { leadId: target.id },
      });
      await tx.crmCommunication.updateMany({
        where: { leadId: source.id },
        data: { leadId: target.id },
      });
      await tx.crmInquiry.updateMany({
        where: { leadId: source.id },
        data: { leadId: target.id },
      });
      await tx.crmLeadDuplicate.deleteMany({
        where: {
          OR: [
            { leadId: source.id },
            { candidateLeadId: source.id },
            { leadId: target.id },
            { candidateLeadId: target.id },
          ],
        },
      });
      await tx.crmLead.update({
        where: { id: source.id },
        data: {
          archivedAt: new Date(),
          statusId: await tx.crmLeadStatus
            .findFirstOrThrow({ where: { code: 'ARCHIVED' } })
            .then((s) => s.id),
          closureReason: 'MERGED',
        },
      });
      await tx.crmLeadHistory.create({
        data: {
          uuid: randomUUID(),
          leadId: target.id,
          eventType: 'MERGED',
          fromValue: source.uuid,
          toValue: target.uuid,
          summary: 'Lead merged',
          actorUserUuid: a.actorUuid,
        },
      });
      return tx.crmLead.findUnique({ where: { id: target.id } });
    });
  }
  async listConfigs(kind: string, q: PageQuery) {
    const p = pageOf(q);
    const map = delegateName[kind];
    if (!map) throw new Error('Invalid configuration type');
    const d = (this.prisma as Row)[map] as {
      findMany: (x: object) => Promise<unknown[]>;
      count: (x: object) => Promise<number>;
    };
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      d.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { createdAt: 'desc' },
      }),
      d.count({ where }),
    ]);
    return pageResult(items, total, q);
  }
  async createConfig(kind: string, i: Row) {
    const map = delegateName[kind];
    if (!map) throw new Error('Invalid configuration type');
    if (kind === 'source')
      return this.prisma.crmLeadSource.create({
        data: {
          uuid: randomUUID(),
          code: toText(i.code),
          name: toText(i.name),
          description: i.description ? toText(i.description) : null,
        },
      });
    if (kind === 'campaign') {
      const source = await this.prisma.crmLeadSource.findFirst({
        where: { uuid: toText(i.sourceUuid), deletedAt: null },
      });
      if (!source) throw new Error('Source not found');
      return this.prisma.crmLeadCampaign.create({
        data: {
          uuid: randomUUID(),
          sourceId: source.id,
          code: toText(i.code),
          name: toText(i.name),
          startsAt: i.startsAt ? new Date(toText(i.startsAt)) : null,
          endsAt: i.endsAt ? new Date(toText(i.endsAt)) : null,
        },
      });
    }
    if (kind === 'type')
      return this.prisma.crmLeadType.create({
        data: {
          uuid: randomUUID(),
          code: toText(i.code),
          name: toText(i.name),
        },
      });
    if (kind === 'status')
      return this.prisma.crmLeadStatus.create({
        data: {
          uuid: randomUUID(),
          code: toText(i.code),
          name: toText(i.name),
          sortOrder: Number(i.sortOrder ?? 0),
          isClosed: i.isClosed === true,
        },
      });
    return this.prisma.crmLeadTag.create({
      data: {
        uuid: randomUUID(),
        code: toText(i.code),
        name: toText(i.name),
        color: i.color ? toText(i.color) : null,
      },
    });
  }
  async updateConfig(kind: string, uuid: string, i: Row) {
    if (kind === 'source')
      return this.prisma.crmLeadSource.update({
        where: { uuid },
        data: {
          ...(i.name !== undefined ? { name: toText(i.name) } : {}),
          ...(i.description !== undefined
            ? {
                description:
                  i.description == null ? null : toText(i.description),
              }
            : {}),
          ...(i.isActive !== undefined
            ? { isActive: i.isActive === true }
            : {}),
        },
      });
    if (kind === 'campaign')
      return this.prisma.crmLeadCampaign.update({
        where: { uuid },
        data: {
          ...(i.name !== undefined ? { name: toText(i.name) } : {}),
          ...(i.isActive !== undefined
            ? { isActive: i.isActive === true }
            : {}),
        },
      });
    if (kind === 'type')
      return this.prisma.crmLeadType.update({
        where: { uuid },
        data: {
          ...(i.name !== undefined ? { name: toText(i.name) } : {}),
          ...(i.isActive !== undefined
            ? { isActive: i.isActive === true }
            : {}),
        },
      });
    if (kind === 'status')
      return this.prisma.crmLeadStatus.update({
        where: { uuid },
        data: {
          ...(i.name !== undefined ? { name: toText(i.name) } : {}),
          ...(i.isClosed !== undefined
            ? { isClosed: i.isClosed === true }
            : {}),
          ...(i.sortOrder !== undefined
            ? { sortOrder: Number(i.sortOrder) }
            : {}),
        },
      });
    return this.prisma.crmLeadTag.update({
      where: { uuid },
      data: {
        ...(i.name !== undefined ? { name: toText(i.name) } : {}),
        ...(i.color !== undefined
          ? { color: i.color == null ? null : toText(i.color) }
          : {}),
        ...(i.isActive !== undefined ? { isActive: i.isActive === true } : {}),
      },
    });
  }
  async archiveConfig(kind: string, uuid: string) {
    if (kind === 'source')
      await this.prisma.crmLeadSource.update({
        where: { uuid },
        data: { deletedAt: new Date(), isActive: false },
      });
    else if (kind === 'campaign')
      await this.prisma.crmLeadCampaign.update({
        where: { uuid },
        data: { deletedAt: new Date(), isActive: false },
      });
    else if (kind === 'type')
      await this.prisma.crmLeadType.update({
        where: { uuid },
        data: { deletedAt: new Date(), isActive: false },
      });
    else if (kind === 'status')
      await this.prisma.crmLeadStatus.update({
        where: { uuid },
        data: { deletedAt: new Date(), isActive: false },
      });
    else
      await this.prisma.crmLeadTag.update({
        where: { uuid },
        data: { isActive: false },
      });
  }
  async createInquiry(i: Row) {
    return this.prisma.crmInquiry.create({
      data: {
        uuid: randomUUID(),
        intent: toText(i.intent),
        status: 'NEW',
        contactId: i.contactUuid
          ? await this.contactId(toText(i.contactUuid))
          : null,
        propertyUuid: i.propertyUuid ? toText(i.propertyUuid) : null,
        requesterName: i.requesterName ? toText(i.requesterName) : null,
        requesterEmail: i.requesterEmail
          ? normalizeEmail(toText(i.requesterEmail))
          : null,
        requesterPhone: i.requesterPhone
          ? normalizePhone(toText(i.requesterPhone))
          : null,
        message: i.message ? toText(i.message) : null,
        preferredChannel: i.preferredChannel
          ? toText(i.preferredChannel)
          : null,
        preferredAt: i.preferredAt ? new Date(toText(i.preferredAt)) : null,
        timezone: i.timezone ? toText(i.timezone) : null,
        deliveryPreference: i.deliveryPreference
          ? toText(i.deliveryPreference)
          : null,
        serviceContext: i.serviceContext ? toText(i.serviceContext) : null,
        spamScore: Number(i.spamScore ?? 0),
      },
    });
  }
  async getInquiry(uuid: string) {
    const r = await this.prisma.crmInquiry.findFirst({ where: { uuid } });
    if (!r) throw new Error('Inquiry not found');
    return r;
  }
  async listInquiries(q: PageQuery & Row) {
    const p = pageOf(q);
    const where: Row = {};
    if (q.intent) where.intent = toText(q.intent);
    if (q.status) where.status = toText(q.status);
    if (q.propertyUuid) where.propertyUuid = toText(q.propertyUuid);
    if (q.leadUuid) where.lead = { uuid: toText(q.leadUuid) };
    const [items, total] = await Promise.all([
      this.prisma.crmInquiry.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.crmInquiry.count({ where }),
    ]);
    return pageResult(items, total, q);
  }
  async updateInquiry(uuid: string, i: Row) {
    return this.prisma.crmInquiry.update({
      where: { uuid },
      data: {
        ...(i.status !== undefined ? { status: toText(i.status) } : {}),
        ...(i.contactUuid !== undefined
          ? {
              contactId: i.contactUuid
                ? await this.contactId(toText(i.contactUuid))
                : null,
            }
          : {}),
        ...(i.message !== undefined
          ? { message: i.message == null ? null : toText(i.message) }
          : {}),
      },
    });
  }
  async convertInquiry(uuid: string, input: Row, a: CrmActor) {
    return this.prisma.$transaction(async (tx) => {
      const inquiry = await tx.crmInquiry.findFirst({ where: { uuid } });
      if (!inquiry) throw new Error('Inquiry not found');
      if (inquiry.convertedAt) throw new Error('Inquiry already converted');
      const contactId = inquiry.contactId;
      if (!contactId) throw new Error('A contact is required for conversion');
      const [source, type, status] = await Promise.all([
        tx.crmLeadSource.findFirst({
          where: {
            uuid: toText(input.sourceUuid),
            isActive: true,
            deletedAt: null,
          },
        }),
        tx.crmLeadType.findFirst({
          where: {
            uuid: toText(input.typeUuid),
            isActive: true,
            deletedAt: null,
          },
        }),
        tx.crmLeadStatus.findFirst({
          where: {
            uuid: toText(input.statusUuid),
            isActive: true,
            deletedAt: null,
          },
        }),
      ]);
      if (!source || !type || !status)
        throw new Error('Invalid conversion configuration');
      const lead = await tx.crmLead.create({
        data: {
          uuid: randomUUID(),
          code: toText(input.code ?? `LEAD-${Date.now()}`),
          contactId,
          sourceId: source.id,
          typeId: type.id,
          statusId: status.id,
        },
      });
      await tx.crmLeadHistory.create({
        data: {
          uuid: randomUUID(),
          leadId: lead.id,
          eventType: 'CONVERTED',
          fromValue: inquiry.uuid,
          actorUserUuid: a.actorUuid,
        },
      });
      await tx.crmInquiry.update({
        where: { id: inquiry.id },
        data: { leadId: lead.id, convertedAt: new Date(), status: 'CONVERTED' },
      });
      return lead;
    });
  }
  async createActivity(i: Row) {
    const contactId = i.contactUuid
      ? await this.contactId(toText(i.contactUuid))
      : null;
    const leadId = i.leadUuid ? await this.leadId(toText(i.leadUuid)) : null;
    if (!contactId && !leadId)
      throw new Error('Activity must reference a contact or lead');
    return this.prisma.crmActivity.create({
      data: {
        uuid: randomUUID(),
        type: toText(i.type),
        status: 'CREATED',
        priority: toText(i.priority ?? 'NORMAL'),
        subject: toText(i.subject),
        description: i.description ? toText(i.description) : null,
        contactId,
        leadId,
        assigneeUserUuid: i.assigneeUserUuid
          ? toText(i.assigneeUserUuid)
          : null,
        dueAt: i.dueAt ? new Date(toText(i.dueAt)) : null,
        callOutcome: i.callOutcome ? toText(i.callOutcome) : null,
        durationSeconds:
          i.durationSeconds != null ? Number(i.durationSeconds) : null,
        meetingStartAt: i.meetingStartAt
          ? new Date(toText(i.meetingStartAt))
          : null,
        meetingEndAt: i.meetingEndAt ? new Date(toText(i.meetingEndAt)) : null,
        location: i.location ? toText(i.location) : null,
        reminderAt: i.reminderAt ? new Date(toText(i.reminderAt)) : null,
      },
    });
  }
  async getActivity(uuid: string) {
    const r = await this.prisma.crmActivity.findFirst({ where: { uuid } });
    if (!r) throw new Error('Activity not found');
    return r;
  }
  async listActivities(q: PageQuery & Row) {
    const p = pageOf(q);
    const where: Row = {};
    for (const k of [
      'type',
      'status',
      'assigneeUserUuid',
      'leadUuid',
      'contactUuid',
    ]) {
      if (q[k])
        where[k === 'leadUuid' ? 'lead' : k === 'contactUuid' ? 'contact' : k] =
          k === 'leadUuid'
            ? { uuid: toText(q[k]) }
            : k === 'contactUuid'
              ? { uuid: toText(q[k]) }
              : toText(q[k]);
    }
    const [items, total] = await Promise.all([
      this.prisma.crmActivity.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { dueAt: 'asc' },
      }),
      this.prisma.crmActivity.count({ where }),
    ]);
    return pageResult(items, total, q);
  }
  async updateActivity(uuid: string, i: Row) {
    const r = await this.getActivity(uuid);
    return this.prisma.crmActivity.update({
      where: { id: (r as Row).id },
      data: {
        ...(i.subject !== undefined ? { subject: toText(i.subject) } : {}),
        ...(i.description !== undefined
          ? {
              description:
                i.description == null ? null : toText(i.description),
            }
          : {}),
        ...(i.dueAt !== undefined
          ? { dueAt: i.dueAt ? new Date(toText(i.dueAt)) : null }
          : {}),
        ...(i.assigneeUserUuid !== undefined
          ? {
              assigneeUserUuid: i.assigneeUserUuid
                ? toText(i.assigneeUserUuid)
                : null,
            }
          : {}),
      },
    });
  }
  async transitionActivity(uuid: string, status: string, a: CrmActor) {
    const r = await this.getActivity(uuid);
    const current = toText((r as Row).status);
    const allowed: Record<string, readonly string[]> = {
      CREATED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
      ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (status !== current && !allowed[current]?.includes(status))
      throw new Error(`Invalid activity transition ${current} -> ${status}`);
    return this.prisma.crmActivity.update({
      where: { id: (r as Row).id },
      data: {
        status,
        startedAt:
          status === 'IN_PROGRESS'
            ? new Date()
            : ((r as Row).startedAt as Date | null),
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });
  }
  async createCommunication(i: Row) {
    return this.prisma.crmCommunication.create({
      data: {
        uuid: randomUUID(),
        channel: toText(i.channel),
        direction: toText(i.direction ?? 'OUTBOUND'),
        status: 'QUEUED',
        contactId: i.contactUuid
          ? await this.contactId(toText(i.contactUuid))
          : null,
        leadId: i.leadUuid ? await this.leadId(toText(i.leadUuid)) : null,
        activityId: i.activityUuid
          ? ((await this.getActivity(toText(i.activityUuid))) as Row).id
          : null,
        templateId: i.templateUuid
          ? (await this.prisma.crmCommunicationTemplate.findFirst({
              where: { uuid: toText(i.templateUuid) },
            }))?.id ?? null
          : null,
        providerName: i.providerName ? toText(i.providerName) : null,
        destination: toText(i.destination),
        subject: i.subject ? toText(i.subject) : null,
        body: toText(i.body),
      },
    });
  }
  async getCommunication(uuid: string) {
    const r = await this.prisma.crmCommunication.findFirst({ where: { uuid } });
    if (!r) throw new Error('Communication not found');
    return r;
  }
  async listCommunications(q: PageQuery & Row) {
    const p = pageOf(q);
    const where: Row = {};
    if (q.channel) where.channel = toText(q.channel);
    if (q.status) where.status = toText(q.status);
    if (q.leadUuid) where.lead = { uuid: toText(q.leadUuid) };
    if (q.contactUuid) where.contact = { uuid: toText(q.contactUuid) };
    const [items, total] = await Promise.all([
      this.prisma.crmCommunication.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.crmCommunication.count({ where }),
    ]);
    return pageResult(items, total, q);
  }
  async transitionCommunication(uuid: string, status: string, i: Row) {
    const r = await this.getCommunication(uuid);
    const current = toText((r as Row).status);
    const allowed: Record<string, readonly string[]> = {
      QUEUED: ['SENT', 'FAILED', 'CANCELLED'],
      SENT: ['DELIVERED', 'FAILED'],
      DELIVERED: [],
      FAILED: [],
      CANCELLED: [],
    };
    if (status !== current && !allowed[current]?.includes(status))
      throw new Error(
        `Invalid communication transition ${current} -> ${status}`,
      );
    return this.prisma.crmCommunication.update({
      where: { id: (r as Row).id },
      data: {
        status,
        providerMessageId: i.providerMessageId
          ? toText(i.providerMessageId)
          : undefined,
        providerError: i.providerError ? toText(i.providerError) : undefined,
        sentAt:
          status === 'SENT' ? new Date() : ((r as Row).sentAt as Date | null),
        deliveredAt:
          status === 'DELIVERED'
            ? new Date()
            : ((r as Row).deliveredAt as Date | null),
        failedAt:
          status === 'FAILED'
            ? new Date()
            : ((r as Row).failedAt as Date | null),
      },
    });
  }
  async listTemplates(q: PageQuery) {
    const p = pageOf(q);
    const [items, total] = await Promise.all([
      this.prisma.crmCommunicationTemplate.findMany({
        skip: p.skip,
        take: p.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.crmCommunicationTemplate.count(),
    ]);
    return pageResult(items, total, q);
  }
  async createTemplate(i: Row) {
    return this.prisma.crmCommunicationTemplate.create({
      data: {
        uuid: randomUUID(),
        code: toText(i.code),
        name: toText(i.name),
        channel: toText(i.channel),
        subject: i.subject ? toText(i.subject) : null,
        body: toText(i.body),
      },
    });
  }
  async updateTemplate(uuid: string, i: Row) {
    const r = await this.prisma.crmCommunicationTemplate.findFirst({
      where: { uuid },
    });
    if (!r) throw new Error('Template not found');
    return this.prisma.crmCommunicationTemplate.update({
      where: { id: r.id },
      data: {
        ...(i.name !== undefined ? { name: toText(i.name) } : {}),
        ...(i.subject !== undefined
          ? { subject: i.subject == null ? null : toText(i.subject) }
          : {}),
        ...(i.body !== undefined ? { body: toText(i.body) } : {}),
        version: { increment: 1 },
      },
    });
  }
}
