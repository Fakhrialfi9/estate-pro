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
  private unwrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((e: unknown) => {
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
    });
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
      assertPlainText(String(output.subject));
    if (output.body !== undefined) {
      const body = String(output.body);
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
      const owner = i.ownerUserUuid ? String(i.ownerUserUuid) : null;
      if (owner) {
        const u = await this.user.getUser(owner);
        if (!u.isActive || u.deletedAt)
          throw new ForbiddenException('Contact owner is not active');
      }
      const r = await this.repo.createContact({
        firstName: normalizeText(String(i.firstName), 100),
        lastName: i.lastName ? normalizeText(String(i.lastName), 100) : null,
        displayName: normalizeText(String(i.displayName), 220),
        companyName: i.companyName
          ? normalizeText(String(i.companyName), 180)
          : null,
        jobTitle: i.jobTitle ? normalizeText(String(i.jobTitle), 120) : null,
        ownerUserUuid: owner,
        source: i.source ? normalizeText(String(i.source), 80) : null,
      });
      await this.auditRecord(
        'CRM_CONTACT_CREATED',
        'contact',
        (r as Record<string, unknown>).uuid as string,
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
                  String(i[field]),
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
        if (patch[field] !== null) assertPlainText(String(patch[field]));
      if (patch.lastName !== null && patch.lastName !== undefined)
        assertPlainText(String(patch.lastName));
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
        i.countryCode = String(i.countryCode).toUpperCase();
        if (!/^[A-Z]{2}$/.test(String(i.countryCode)))
          throw new BadRequestException('countryCode must be ISO-3166 alpha-2');
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
    u: string,
    i: Record<string, unknown>,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      if (kind === 'email' && i.value !== undefined) {
        if (typeof i.value !== 'string')
          throw new BadRequestException('Email value is required');
        i.value = normalizeEmail(i.value);
      }
      if (kind === 'phone' && i.value !== undefined) {
        if (typeof i.value !== 'string')
          throw new BadRequestException('Phone value is required');
        i.value = normalizePhone(i.value);
      }
      for (const [key, value] of Object.entries(i))
        if (
          value !== null &&
          typeof value === 'string' &&
          [
            'line1',
            'line2',
            'city',
            'region',
            'postalCode',
            'type',
            'value',
          ].includes(key)
        )
          assertPlainText(value);
      const r = await this.repo.updateContactChild(kind, contactUuid, u, i);
      await this.auditRecord(
        `CRM_CONTACT_${kind.toUpperCase()}_UPDATED`,
        'contact_child',
        u,
        a,
      );
      return r;
    });
  }
  childDelete(
    kind: 'address' | 'phone' | 'email',
    contactUuid: string,
    u: string,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      await this.repo.deleteContactChild(kind, contactUuid, u);
      await this.auditRecord(
        `CRM_CONTACT_${kind.toUpperCase()}_DELETED`,
        'contact_child',
        u,
        a,
      );
    });
  }
  childPrimary(
    kind: 'address' | 'phone' | 'email',
    c: string,
    u: string,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      const r = await this.repo.setContactPrimary(kind, c, u);
      await this.auditRecord(
        `CRM_CONTACT_${kind.toUpperCase()}_PRIMARY_SET`,
        'contact',
        c,
        a,
      );
      return r;
    });
  }
  preferences(c: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.upsertPreferences(c, i);
      await this.auditRecord(
        'CRM_CONTACT_PREFERENCES_UPDATED',
        'contact',
        c,
        a,
      );
      return r;
    });
  }
  consent(c: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.addConsent(c, i, a);
      await this.auditRecord('CRM_CONTACT_CONSENT_RECORDED', 'contact', c, a);
      return r;
    });
  }
  relationship(c: string, t: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      if (c === t)
        throw new BadRequestException('A contact cannot relate to itself');
      const r = await this.repo.relationship(c, t, i);
      await this.auditRecord(
        'CRM_CONTACT_RELATIONSHIP_CREATED',
        'contact_relationship',
        (r as Record<string, unknown>).uuid as string,
        a,
      );
      return r;
    });
  }
  removeRelationship(u: string, a: CrmActor) {
    return this.unwrap(async () => {
      await this.repo.removeRelationship(u);
      await this.auditRecord(
        'CRM_CONTACT_RELATIONSHIP_REMOVED',
        'contact_relationship',
        u,
        a,
      );
    });
  }
  createLead(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      if (i.ownerUserUuid) {
        const u = await this.user.getUser(String(i.ownerUserUuid));
        if (!u.isActive || u.deletedAt)
          throw new ForbiddenException('Lead owner is not active');
      }
      const r = await this.repo.createLead(i, a);
      await this.auditRecord(
        'CRM_LEAD_CREATED',
        'lead',
        (r as Record<string, unknown>).uuid as string,
        a,
      );
      return r;
    });
  }
  getLead(u: string) {
    return this.unwrap(() => this.repo.getLead(u));
  }
  listLeads(q: PageQuery & Record<string, unknown>) {
    return this.repo.listLeads(q);
  }
  updateLead(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
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
  changeStatus(u: string, s: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.changeLeadStatus(u, s, a);
      await this.auditRecord('CRM_LEAD_STATUS_CHANGED', 'lead', u, a);
      return r;
    });
  }
  assign(u: string, user: string, a: CrmActor) {
    return this.unwrap(async () => {
      if (!user) throw new BadRequestException('Assignee is required');
      const target = await this.user.getUser(user);
      if (!target.isActive || target.deletedAt)
        throw new ForbiddenException('Assignee is not active');
      const r = await this.repo.assignLead(u, user, a);
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
      assertPlainText(body);
      const r = await this.repo.addLeadNote(u, normalizeText(body, 5000), a);
      await this.auditRecord('CRM_LEAD_NOTE_CREATED', 'lead', u, a);
      return r;
    });
  }
  tag(u: string, t: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.tagLead(u, t);
      await this.auditRecord('CRM_LEAD_TAG_ATTACHED', 'lead', u, a);
      return r;
    });
  }
  untag(u: string, t: string, a: CrmActor) {
    return this.unwrap(async () => {
      await this.repo.untagLead(u, t);
      await this.auditRecord('CRM_LEAD_TAG_REMOVED', 'lead', u, a);
    });
  }
  history(u: string, q: PageQuery) {
    return this.repo.listLeadHistory(u, q);
  }
  score(u: string) {
    return this.unwrap(() => this.repo.getLeadScore(u));
  }
  scoreRules() {
    return this.repo.listScoreRules();
  }
  createScoreRule(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      if (
        !SCORE_FIELDS.has(String(i.field)) ||
        !SCORE_OPERATORS.has(String(i.operator))
      )
        throw new BadRequestException(
          'Unsupported score rule field or operator',
        );
      const r = await this.repo.createScoreRule(i);
      await this.auditRecord(
        'CRM_SCORE_RULE_CREATED',
        'score_rule',
        (r as Record<string, unknown>).uuid as string,
        a,
      );
      return r;
    });
  }
  updateScoreRule(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      if (i.field !== undefined && !SCORE_FIELDS.has(String(i.field)))
        throw new BadRequestException('Unsupported score rule field');
      if (i.operator !== undefined && !SCORE_OPERATORS.has(String(i.operator)))
        throw new BadRequestException('Unsupported score rule operator');
      const r = await this.repo.updateScoreRule(u, i);
      await this.auditRecord('CRM_SCORE_RULE_UPDATED', 'score_rule', u, a);
      return r;
    });
  }
  deleteScoreRule(u: string, a: CrmActor) {
    return this.unwrap(async () => {
      await this.repo.deleteScoreRule(u);
      await this.auditRecord('CRM_SCORE_RULE_DELETED', 'score_rule', u, a);
    });
  }
  recalcScore(u: string, a: CrmActor) {
    return this.unwrap(async () => {
      const lead = (await this.repo.getLead(u)) as Record<string, unknown>;
      const contact = lead.contact as Record<string, unknown>;
      const rules = (await this.repo.listScoreRules()) as ScoreRule[];
      const input: ScoreInput = {
        values: {
          displayName: contact.displayName,
          source: (lead.source as Record<string, unknown>)?.code,
          status: (lead.status as Record<string, unknown>)?.code,
          type: (lead.type as Record<string, unknown>)?.code,
          ownerUserUuid: lead.ownerUserUuid,
          score: lead.score,
        },
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
  duplicates(u: string) {
    return this.unwrap(() => this.repo.detectDuplicates(u));
  }
  duplicateList(q: PageQuery) {
    return this.repo.listDuplicates(q);
  }
  duplicateReview(u: string, status: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.reviewDuplicate(u, status, a);
      await this.auditRecord('CRM_DUPLICATE_REVIEWED', 'duplicate', u, a);
      return r;
    });
  }
  merge(source: string, target: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.mergeLeads(source, target, a);
      await this.auditRecord(
        'CRM_LEAD_MERGED',
        'lead',
        target,
        a,
        `source=${source}`,
      );
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
      const r = await this.repo.createConfig(kind, i);
      await this.auditRecord(
        `CRM_${kind.toUpperCase()}_CREATED`,
        kind,
        (r as Record<string, unknown>).uuid as string,
        a,
      );
      return r;
    });
  }
  configUpdate(
    kind: string,
    u: string,
    i: Record<string, unknown>,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      this.assertConfigKind(kind);
      const r = await this.repo.updateConfig(kind, u, i);
      await this.auditRecord(`CRM_${kind.toUpperCase()}_UPDATED`, kind, u, a);
      return r;
    });
  }
  configDelete(kind: string, u: string, a: CrmActor) {
    return this.unwrap(async () => {
      this.assertConfigKind(kind);
      await this.repo.archiveConfig(kind, u);
      await this.auditRecord(`CRM_${kind.toUpperCase()}_ARCHIVED`, kind, u, a);
    });
  }
  inquiry(i: Record<string, unknown>, a?: CrmActor) {
    return this.unwrap(async () => {
      for (const field of ['message', 'serviceContext'])
        if (typeof i[field] === 'string') assertPlainText(String(i[field]));
      if (i.propertyUuid)
        await this.property.getProperty(String(i.propertyUuid));
      const r = await this.repo.createInquiry(i);
      if (a)
        await this.auditRecord(
          'CRM_INQUIRY_CREATED',
          'inquiry',
          (r as Record<string, unknown>).uuid as string,
          a,
        );
      return r;
    });
  }
  inquiryGet(u: string) {
    return this.unwrap(() => this.repo.getInquiry(u));
  }
  inquiryList(q: PageQuery & Record<string, unknown>) {
    return this.repo.listInquiries(q);
  }
  inquiryUpdate(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      if (typeof i.message === 'string') assertPlainText(String(i.message));
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
      if (i.description) assertPlainText(String(i.description));
      const r = await this.repo.createActivity(i);
      await this.auditRecord(
        'CRM_ACTIVITY_CREATED',
        'activity',
        (r as Record<string, unknown>).uuid as string,
        a,
      );
      return r;
    });
  }
  activityGet(u: string) {
    return this.unwrap(() => this.repo.getActivity(u));
  }
  activityList(q: PageQuery & Record<string, unknown>) {
    return this.repo.listActivities(q);
  }
  activityUpdate(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      for (const field of ['subject', 'description'])
        if (typeof i[field] === 'string') assertPlainText(String(i[field]));
      const r = await this.repo.updateActivity(u, i);
      await this.auditRecord('CRM_ACTIVITY_UPDATED', 'activity', u, a);
      return r;
    });
  }
  activityTransition(u: string, status: string, a: CrmActor) {
    return this.unwrap(async () => {
      const r = await this.repo.transitionActivity(u, status, a);
      await this.auditRecord('CRM_ACTIVITY_STATUS_CHANGED', 'activity', u, a);
      return r;
    });
  }
  communicationCreate(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      if (i.providerSecret)
        throw new BadRequestException(
          'Provider secrets are not accepted by the API',
        );
      assertPlainText(String(i.body));
      const r = await this.repo.createCommunication(i);
      await this.auditRecord(
        'CRM_COMMUNICATION_CREATED',
        'communication',
        (r as Record<string, unknown>).uuid as string,
        a,
      );
      return r;
    });
  }
  communicationGet(u: string) {
    return this.unwrap(() => this.repo.getCommunication(u));
  }
  communicationList(q: PageQuery & Record<string, unknown>) {
    return this.repo.listCommunications(q);
  }
  communicationTransition(
    u: string,
    status: string,
    i: Record<string, unknown>,
    a: CrmActor,
  ) {
    return this.unwrap(async () => {
      for (const field of ['providerMessageId', 'providerError'])
        if (i[field] !== undefined && typeof i[field] === 'string')
          assertPlainText(String(i[field]));
      if (i.providerSecret)
        throw new BadRequestException(
          'Provider secrets are not accepted by the API',
        );
      const r = await this.repo.transitionCommunication(u, status, i);
      await this.auditRecord(
        'CRM_COMMUNICATION_STATUS_CHANGED',
        'communication',
        u,
        a,
      );
      return r;
    });
  }
  templates(q: PageQuery) {
    return this.repo.listTemplates(q);
  }
  templateCreate(i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const validated = this.validateTemplate(i);
      const body = String(validated.body);
      const r = await this.repo.createTemplate({ ...validated, body });
      await this.auditRecord(
        'CRM_TEMPLATE_CREATED',
        'communication_template',
        (r as Record<string, unknown>).uuid as string,
        a,
      );
      return r;
    });
  }
  templateUpdate(u: string, i: Record<string, unknown>, a: CrmActor) {
    return this.unwrap(async () => {
      const validated = this.validateTemplate(i);
      const r = await this.repo.updateTemplate(u, validated);
      await this.auditRecord(
        'CRM_TEMPLATE_UPDATED',
        'communication_template',
        u,
        a,
      );
      return r;
    });
  }
}
