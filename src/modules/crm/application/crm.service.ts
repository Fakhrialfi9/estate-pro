import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import { PROPERTY_PUBLIC_PORT } from '../../../common/contracts/property-public.port.js';
import type { PropertyPublicPort } from '../../../common/contracts/property-public.port.js';
import { USER_PUBLIC_PORT } from '../../../common/contracts/user-public.port.js';
import type { UserPublicPort } from '../../../common/contracts/user-public.port.js';
import {
  calculateScore,
  assertPlainText,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  toText,
  type CrmActor,
  type PageQuery,
  type ScoreInput,
  type ScoreRule,
} from '../domain/crm.types.js';
import { CRM_REPOSITORY } from '../domain/repositories/crm.repository.js';
import type { CrmRepository } from '../domain/repositories/crm.repository.js';

const CONFIG_KINDS = new Set(['source', 'campaign', 'type', 'status', 'tag']);
const SCORE_FIELDS = new Set([
  'displayName',
  'source',
  'status',
  'type',
  'ownerUserUuid',
  'score',
]);
const SCORE_OPERATORS = new Set([
  'EQ',
  'NEQ',
  'CONTAINS',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'TRUE',
  'FALSE',
]);
const TEMPLATE_VARIABLES = new Set([
  'contact.name',
  'contact.email',
  'contact.phone',
  'lead.code',
  'lead.status',
  'lead.score',
]);

@Injectable()
export class CrmService {
  constructor(
    @Inject(CRM_REPOSITORY) private readonly repo: CrmRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    @Inject(PROPERTY_PUBLIC_PORT) private readonly property: PropertyPublicPort,
    @Inject(USER_PUBLIC_PORT) private readonly user: UserPublicPort,
  ) {}
  private async auditRecord(
    action: string,
    entityType: string,
    entityUuid: string,
    actor: CrmActor,
    reason?: string,
  ) {
    await this.audit.record({
      action,
      entityType,
      entityUuid,
      actorUuid: actor.actorUuid,
      userUuid: actor.actorUuid,
      actorType: 'AUTHENTICATED',
      requestId: actor.requestId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      result: 'SUCCESS',
      ...(reason ? { reason } : {}),
    });
  }
  private async unwrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (
        e instanceof NotFoundException ||
        e instanceof ForbiddenException ||
        e instanceof BadRequestException ||
        e instanceof ConflictException
      )
        throw e;
      const m = e instanceof Error ? e.message : 'Request failed';
      if (/already exists|unique|duplicate/i.test(m))
        throw new ConflictException(m);
      if (/not found/i.test(m)) throw new NotFoundException(m);
      throw new BadRequestException(m);
    }
  }
  private assertConfigKind(kind: string): void {
    if (!CONFIG_KINDS.has(kind))
      throw new BadRequestException('Invalid CRM configuration type');
  }
  private validateTemplate(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const output = { ...input };
    if (output.subject !== undefined && output.subject !== null)
      assertPlainText(toText(output.subject));
    if (output.body !== undefined) {
      const body = toText(output.body);
      assertPlainText(body);
      for (const match of body.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)) {
        const variable = match[1];
        if (variable && !TEMPLATE_VARIABLES.has(variable))
          throw new BadRequestException(
            `Unsupported template variable: ${variable}`,
          );
      }
    }
    return output;
  }
  createContact(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const owner = i.ownerUserUuid ? toText(i.ownerUserUuid) : null;
      if (owner) {
        const u = await this.user.getUser(owner);
        if (!u.isActive || u.deletedAt)
          throw new ForbiddenException('Contact owner is not active');
      }
      const r = await this.repo.createContact({
        firstName: normalizeText(toText(i.firstName), 100),
        lastName: i.lastName ? normalizeText(toText(i.lastName), 100) : null,
        displayName: normalizeText(toText(i.displayName), 220),
        companyName: i.companyName
          ? normalizeText(toText(i.companyName), 180)
          : null,
        jobTitle: i.jobTitle ? normalizeText(toText(i.jobTitle), 120) : null,
        ownerUserUuid: owner,
        source: i.source ? normalizeText(toText(i.source), 80) : null,
      });
      await this.auditRecord(
        'CRM_CONTACT_CREATED',
        'contact',
        toText((r as Record<string, unknown>).uuid),
        a,
      );
      return r;
    });
  }
  getContact(u: string) {
    return this.unwrap(() => this.repo.getContact(u));
  }
  listContacts(q: PageQuery) {
    return this.repo.listContacts(q);
  }
  updateContact(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const patch: { [key: string]: unknown } = {};
      for (const field of [
        'firstName',
        'lastName',
        'displayName',
        'companyName',
        'jobTitle',
      ])
        if (i[field] !== undefined)
          patch[field] =
            i[field] === null
              ? null
              : normalizeText(
                  toText(i[field]),
                  field === 'displayName'
                    ? 220
                    : ['firstName', 'lastName'].includes(field)
                      ? 100
                      : field === 'companyName'
                        ? 180
                        : 120,
                );
      for (const field of [
        'firstName',
        'displayName',
        'companyName',
        'jobTitle',
      ])
        if (patch[field] !== null) assertPlainText(toText(patch[field]));
      if (patch.lastName !== null && patch.lastName !== undefined)
        assertPlainText(toText(patch.lastName));
      const r = await this.repo.updateContact(u, patch);
      await this.auditRecord('CRM_CONTACT_UPDATED', 'contact', u, a);
      return r;
    });
  }
  archiveContact(u: string, a: CrmActor) {
    return this.unwrap(async () => {
      await this.repo.archiveContact(u);
      await this.auditRecord('CRM_CONTACT_ARCHIVED', 'contact', u, a);
    });
  }
  child(
    kind: 'address' | 'phone' | 'email',
    contactUuid: string,
    i: Record<string, unknown>,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      let r: unknown;
      if (kind === 'email') {
        if (typeof i.value !== 'string')
          throw new BadRequestException('Email value is required');
        i.value = normalizeEmail(i.value);
        r = await this.repo.addContactEmail(contactUuid, i);
      } else if (kind === 'phone') {
        if (typeof i.value !== 'string')
          throw new BadRequestException('Phone value is required');
        i.value = normalizePhone(i.value);
        r = await this.repo.addContactPhone(contactUuid, i);
      } else {
        if (typeof i.line1 !== 'string')
          throw new BadRequestException('Address line1 is required');
        i.line1 = normalizeText(i.line1, 220);
        i.city = i.city ? normalizeText(toText(i.city), 120) : null;
        i.state = i.state ? normalizeText(toText(i.state), 120) : null;
        i.postalCode = i.postalCode
          ? normalizeText(toText(i.postalCode), 30)
          : null;
        i.country = i.country ? normalizeText(toText(i.country), 120) : null;
        r = await this.repo.addContactAddress(contactUuid, i);
      }
      await this.auditRecord(
        `CRM_CONTACT_${kind.toUpperCase()}_CREATED`,
        'contact',
        contactUuid,
        a,
      );
      return r;
    });
  }
  childUpdate(
    kind: 'address' | 'phone' | 'email',
    contactUuid: string,
    childUuid: string,
    i: Record<string, unknown>,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      if (kind === 'email' && typeof i.value === 'string')
        i.value = normalizeEmail(i.value);
      if (kind === 'phone' && typeof i.value === 'string')
        i.value = normalizePhone(i.value);
      if (typeof i.line1 === 'string') i.line1 = normalizeText(i.line1, 220);
      const r = await this.repo.updateContactChild(
        kind,
        contactUuid,
        childUuid,
        i,
      );
      await this.auditRecord(
        `CRM_CONTACT_${kind.toUpperCase()}_UPDATED`,
        'contact',
        contactUuid,
        a,
      );
      return r;
    });
  }
  childDelete(
    kind: 'address' | 'phone' | 'email',
    contactUuid: string,
    childUuid: string,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      await this.repo.deleteContactChild(kind, contactUuid, childUuid);
      await this.auditRecord(
        `CRM_CONTACT_${kind.toUpperCase()}_DELETED`,
        'contact',
        contactUuid,
        a,
      );
    });
  }
  childPrimary(
    kind: 'address' | 'phone' | 'email',
    contactUuid: string,
    childUuid: string,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      const r = await this.repo.setContactChildPrimary(
        kind,
        contactUuid,
        childUuid,
      );
      await this.auditRecord(
        `CRM_CONTACT_${kind.toUpperCase()}_PRIMARY_SET`,
        'contact',
        contactUuid,
        a,
      );
      return r;
    });
  }
  preferences(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.setContactPreferences(u, i);
      await this.auditRecord('CRM_CONTACT_PREFERENCES_UPDATED', 'contact', u, a);
      return r;
    });
  }
  consent(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const action = toText(i.action).toUpperCase();
      if (!['GRANT', 'REVOKE'].includes(action))
        throw new BadRequestException('Consent action must be GRANT or REVOKE');
      const r = await this.repo.recordConsent(u, i);
      await this.auditRecord(
        action === 'GRANT' ? 'CRM_CONSENT_GRANTED' : 'CRM_CONSENT_REVOKED',
        'contact',
        u,
        a,
      );
      return r;
    });
  }
  relationship(
    u: string,
    target: string,
    i: Record<string, unknown>,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      if (u === target)
        throw new BadRequestException('Contact cannot relate to itself');
      const r = await this.repo.addRelationship(u, target, i);
      await this.auditRecord('CRM_CONTACT_RELATIONSHIP_CREATED', 'contact', u, a);
      return r;
    });
  }
  removeRelationship(u: string, a: CrmActor) {
    return this.unwrap(async () => {
      await this.repo.removeRelationship(u);
      await this.auditRecord('CRM_CONTACT_RELATIONSHIP_DELETED', 'contact', u, a);
    });
  }
  createLead(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const contact = toText(i.contactUuid);
      await this.repo.getContact(contact);
      if (i.ownerUserUuid) {
        const owner = await this.user.getUser(toText(i.ownerUserUuid));
        if (!owner.isActive || owner.deletedAt)
          throw new ForbiddenException('Lead owner is not active');
      }
      const r = await this.repo.createLead({ ...i, contactUuid: contact });
      await this.auditRecord(
        'CRM_LEAD_CREATED',
        'lead',
        toText((r as Record<string, unknown>).uuid),
        a,
      );
      return r;
    });
  }
  listLeads(q: PageQuery) {
    return this.repo.listLeads(q);
  }
  getLead(u: string) {
    return this.unwrap(() => this.repo.getLead(u));
  }
  updateLead(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      if (i.code !== undefined && typeof i.code !== 'string')
        throw new BadRequestException('Lead code must be text');
      const r = await this.repo.updateLead(u, i);
      await this.auditRecord('CRM_LEAD_UPDATED', 'lead', u, a);
      return r;
    });
  }
  archiveLead(u: string, a: CrmActor) {
    return this.unwrap(async () => {
      await this.repo.archiveLead(u);
      await this.auditRecord('CRM_LEAD_ARCHIVED', 'lead', u, a);
    });
  }
  changeStatus(u: string, status: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.changeLeadStatus(u, status, a);
      await this.auditRecord('CRM_LEAD_STATUS_CHANGED', 'lead', u, a);
      return r;
    });
  }
  assign(u: string, userUuid: string, a: CrmActor) {
    return this.unwrap(async () => {
      const user = await this.user.getUser(userUuid);
      if (!user.isActive || user.deletedAt)
        throw new ForbiddenException('Assignee is not active');
      const r = await this.repo.assignLead(u, userUuid, a);
      await this.auditRecord('CRM_LEAD_ASSIGNED', 'lead', u, a);
      return r;
    });
  }
  unassign(u: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.unassignLead(u, a);
      await this.auditRecord('CRM_LEAD_UNASSIGNED', 'lead', u, a);
      return r;
    });
  }
  note(u: string, body: string, a: CrmActor) {
    return this.unwrap(async () => {
      const text = normalizeText(body, 5000);
      assertPlainText(text);
      const r = await this.repo.addLeadNote(u, text, a);
      await this.auditRecord('CRM_LEAD_NOTE_ADDED', 'lead', u, a);
      return r;
    });
  }
  tag(u: string, t: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.attachLeadTag(u, t);
      await this.auditRecord('CRM_LEAD_TAG_ATTACHED', 'lead', u, a);
      return r;
    });
  }
  untag(u: string, t: string, a: CrmActor) {
    return this.unwrap(async () => {
      await this.repo.detachLeadTag(u, t);
      await this.auditRecord('CRM_LEAD_TAG_DETACHED', 'lead', u, a);
    });
  }
  history(u: string, q: PageQuery) {
    return this.repo.leadHistory(u, q);
  }
  score(u: string) {
    return this.repo.getLeadScore(u);
  }
  recalcScore(u: string, a: CrmActor) {
    return this.unwrap(async () => {
      const lead = await this.repo.getLead(u);
      const rawRules = await this.repo.listScoreRules();
      const rules: ScoreRule[] = rawRules.map((x) => ({
        uuid: toText((x as Record<string, unknown>).uuid),
        field: toText((x as Record<string, unknown>).field),
        operator: toText((x as Record<string, unknown>).operator),
        value: toText((x as Record<string, unknown>).value),
        points: Number((x as Record<string, unknown>).points),
        isActive: Boolean((x as Record<string, unknown>).isActive),
      }));
      for (const rule of rules) {
        if (!SCORE_FIELDS.has(rule.field) || !SCORE_OPERATORS.has(rule.operator))
          throw new BadRequestException('Invalid score rule');
      }
      const input: ScoreInput = {
        displayName: toText((lead as Record<string, unknown>).displayName),
        source: toText((lead as Record<string, unknown>).source),
        status: toText((lead as Record<string, unknown>).status),
        type: toText((lead as Record<string, unknown>).type),
        ownerUserUuid: toText((lead as Record<string, unknown>).ownerUserUuid),
      };
      const calculated = calculateScore(input, rules);
      const r = await this.repo.saveScore(
        u,
        calculated.score,
        calculated.factors,
      );
      await this.auditRecord('CRM_LEAD_SCORE_RECALCULATED', 'lead', u, a);
      return { ...r, factors: calculated.factors };
    });
  }
  async duplicates(u: string): Promise<readonly unknown[]> {
    return await this.unwrap<readonly unknown[]>(() =>
      this.repo.detectDuplicates(u),
    );
  }
  duplicateList(q: PageQuery) {
    return this.repo.listDuplicates(q);
  }
  duplicateReview(u: string, status: string, a: CrmActor) {
    return this.unwrap(async () => {
      if (!['CONFIRMED', 'IGNORED'].includes(status))
        throw new BadRequestException('Invalid duplicate review status');
      const r = await this.repo.reviewDuplicate(u, status, a);
      await this.auditRecord('CRM_DUPLICATE_REVIEWED', 'duplicate', u, a);
      return r;
    });
  }
  merge(source: string, target: string, a: CrmActor) {
    return this.unwrap(async () => {
      if (source === target)
        throw new BadRequestException('Cannot merge a lead with itself');
      const r = await this.repo.mergeLeads(source, target, a);
      await this.auditRecord('CRM_LEAD_MERGED', 'lead', target, a);
      return r;
    });
  }
  configList(kind: string, q: PageQuery) {
    this.assertConfigKind(kind);
    return this.repo.listConfigs(kind, q);
  }
  configCreate(kind: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      this.assertConfigKind(kind);
      if (!i.code || !i.name)
        throw new BadRequestException('Configuration code and name are required');
      const r = await this.repo.createConfig(kind, i);
      await this.auditRecord('CRM_CONFIG_CREATED', kind, toText((r as Record<string, unknown>).uuid), a);
      return r;
    });
  }
  configUpdate(kind: string, u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      this.assertConfigKind(kind);
      const r = await this.repo.updateConfig(kind, u, i);
      await this.auditRecord('CRM_CONFIG_UPDATED', kind, u, a);
      return r;
    });
  }
  configDelete(kind: string, u: string, a: CrmActor) {
    return this.unwrap(async () => {
      this.assertConfigKind(kind);
      await this.repo.archiveConfig(kind, u);
      await this.auditRecord('CRM_CONFIG_ARCHIVED', kind, u, a);
    });
  }
  inquiry(i: Record<string, unknown>, a?: CrmActor) {
    return this.unwrap(async () => {
      if (i.website) throw new ForbiddenException('Spam detected');
      const intent = toText(i.intent);
      if (!['PROPERTY_INQUIRY', 'CONTACT_MESSAGE', 'PRICE_REQUEST', 'CALLBACK_REQUEST', 'CONSULTATION', 'BROCHURE_REQUEST', 'VIEWING_REQUEST'].includes(intent))
        throw new BadRequestException('Unsupported inquiry intent');
      if (i.message !== undefined) assertPlainText(normalizeText(toText(i.message), 5000));
      const payload = { ...i, ...(a ? { actorUuid: a.actorUuid, requestId: a.requestId } : {}) };
      return this.repo.createInquiry(payload);
    });
  }
  inquiryList(q: PageQuery) {
    return this.repo.listInquiries(q);
  }
  inquiryGet(u: string) {
    return this.unwrap(() => this.repo.getInquiry(u));
  }
  inquiryUpdate(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.updateInquiry(u, i);
      await this.auditRecord('CRM_INQUIRY_UPDATED', 'inquiry', u, a);
      return r;
    });
  }
  inquiryConvert(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.convertInquiry(u, i, a);
      await this.auditRecord('CRM_INQUIRY_CONVERTED', 'inquiry', u, a);
      return r;
    });
  }
  activityCreate(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.createActivity(i, a);
      await this.auditRecord('CRM_ACTIVITY_CREATED', 'activity', toText((r as Record<string, unknown>).uuid), a);
      return r;
    });
  }
  activityList(q: PageQuery) {
    return this.repo.listActivities(q);
  }
  activityGet(u: string) {
    return this.unwrap(() => this.repo.getActivity(u));
  }
  activityUpdate(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.updateActivity(u, i, a);
      await this.auditRecord('CRM_ACTIVITY_UPDATED', 'activity', u, a);
      return r;
    });
  }
  activityStatus(u: string, status: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.transitionActivity(u, status, a);
      await this.auditRecord('CRM_ACTIVITY_STATUS_CHANGED', 'activity', u, a);
      return r;
    });
  }
  timeline(u: string, q: PageQuery) {
    return this.repo.activityTimeline(u, q);
  }
  communicationCreate(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const payload = this.validateTemplate(i);
      const r = await this.repo.createCommunication(payload as Record<string, unknown>);
      await this.auditRecord('CRM_COMMUNICATION_CREATED', 'communication', toText((r as Record<string, unknown>).uuid), a);
      return r;
    });
  }
  communicationList(q: PageQuery) {
    return this.repo.listCommunications(q);
  }
  communicationGet(u: string) {
    return this.unwrap(() => this.repo.getCommunication(u));
  }
  communicationStatus(u: string, status: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.transitionCommunication(u, status, a);
      await this.auditRecord('CRM_COMMUNICATION_STATUS_CHANGED', 'communication', u, a);
      return r;
    });
  }
  templateList(q: PageQuery) {
    return this.repo.listTemplates(q);
  }
  templateCreate(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const payload = this.validateTemplate(i);
      const r = await this.repo.createTemplate(payload);
      await this.auditRecord('CRM_TEMPLATE_CREATED', 'template', toText((r as Record<string, unknown>).uuid), a);
      return r;
    });
  }
  templateUpdate(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const payload = this.validateTemplate(i);
      const r = await this.repo.updateTemplate(u, payload);
      await this.auditRecord('CRM_TEMPLATE_UPDATED', 'template', u, a);
      return r;
    });
  }
}
