import type { PageQuery, CrmActor } from '../crm.types.js';

export interface CrmRepository {
  createContact(input: Record<string, unknown>): Promise<unknown>;
  getContact(uuid: string): Promise<unknown>;
  listContacts(query: PageQuery): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateContact(uuid: string, input: Record<string, unknown>): Promise<unknown>;
  archiveContact(uuid: string): Promise<void>;
  addContactAddress(
    contactUuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  addContactPhone(
    contactUuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  addContactEmail(
    contactUuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  updateContactChild(
    kind: string,
    contactUuid: string,
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  deleteContactChild(
    kind: string,
    contactUuid: string,
    uuid: string,
  ): Promise<void>;
  setContactPrimary(
    kind: string,
    contactUuid: string,
    uuid: string,
  ): Promise<unknown>;
  upsertPreferences(
    contactUuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  addConsent(
    contactUuid: string,
    input: Record<string, unknown>,
    actor: CrmActor,
  ): Promise<unknown>;
  relationship(
    contactUuid: string,
    targetUuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  removeRelationship(uuid: string): Promise<void>;
  createLead(input: Record<string, unknown>, actor: CrmActor): Promise<unknown>;
  getLead(uuid: string): Promise<unknown>;
  listLeads(query: PageQuery & Record<string, unknown>): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateLead(uuid: string, input: Record<string, unknown>): Promise<unknown>;
  archiveLead(uuid: string): Promise<void>;
  changeLeadStatus(
    uuid: string,
    statusUuid: string,
    actor: CrmActor,
  ): Promise<unknown>;
  assignLead(uuid: string, userUuid: string, actor: CrmActor): Promise<unknown>;
  unassignLead(uuid: string, actor: CrmActor): Promise<unknown>;
  addLeadNote(uuid: string, body: string, actor: CrmActor): Promise<unknown>;
  tagLead(uuid: string, tagUuid: string): Promise<unknown>;
  untagLead(uuid: string, tagUuid: string): Promise<void>;
  listLeadHistory(
    uuid: string,
    query: PageQuery,
  ): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  getLeadScore(uuid: string): Promise<unknown>;
  saveScore(
    uuid: string,
    score: number,
    factors: readonly { code: string; points: number; explanation: string }[],
  ): Promise<unknown>;
  listScoreRules(): Promise<readonly unknown[]>;
  createScoreRule(input: Record<string, unknown>): Promise<unknown>;
  updateScoreRule(
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  deleteScoreRule(uuid: string): Promise<void>;
  detectDuplicates(uuid: string): Promise<readonly unknown[]>;
  listDuplicates(query: PageQuery): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  reviewDuplicate(
    uuid: string,
    status: string,
    actor: CrmActor,
  ): Promise<unknown>;
  mergeLeads(
    sourceUuid: string,
    targetUuid: string,
    actor: CrmActor,
  ): Promise<unknown>;
  listConfigs(
    kind: string,
    query: PageQuery,
  ): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  createConfig(kind: string, input: Record<string, unknown>): Promise<unknown>;
  updateConfig(
    kind: string,
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  archiveConfig(kind: string, uuid: string): Promise<void>;
  createInquiry(input: Record<string, unknown>): Promise<unknown>;
  getInquiry(uuid: string): Promise<unknown>;
  listInquiries(query: PageQuery & Record<string, unknown>): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateInquiry(uuid: string, input: Record<string, unknown>): Promise<unknown>;
  convertInquiry(
    uuid: string,
    lead: Record<string, unknown>,
    actor: CrmActor,
  ): Promise<unknown>;
  createActivity(input: Record<string, unknown>): Promise<unknown>;
  getActivity(uuid: string): Promise<unknown>;
  listActivities(query: PageQuery & Record<string, unknown>): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateActivity(
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  transitionActivity(
    uuid: string,
    status: string,
    actor: CrmActor,
  ): Promise<unknown>;
  createCommunication(input: Record<string, unknown>): Promise<unknown>;
  getCommunication(uuid: string): Promise<unknown>;
  listCommunications(query: PageQuery & Record<string, unknown>): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  transitionCommunication(
    uuid: string,
    status: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
  listTemplates(query: PageQuery): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }>;
  createTemplate(input: Record<string, unknown>): Promise<unknown>;
  updateTemplate(
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}
export const CRM_REPOSITORY = Symbol('CRM_REPOSITORY');
