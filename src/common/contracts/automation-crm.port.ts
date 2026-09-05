import type { AutomationActor } from './automation-actor.js';

export interface AutomationLeadContext {
  readonly uuid: string;
  readonly contactUuid?: string | null;
  readonly status?: string | null;
  readonly source?: string | null;
  readonly type?: string | null;
  readonly ownerUserUuid?: string | null;
  readonly score?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export interface AutomationActivityInput {
  readonly leadUuid?: string;
  readonly contactUuid?: string;
  readonly type: string;
  readonly subject: string;
  readonly description?: string;
  readonly dueAt?: string;
  readonly reminderAt?: string;
  readonly assigneeUserUuid?: string | null;
}

export interface AutomationCommunicationInput {
  readonly contactUuid?: string;
  readonly leadUuid?: string;
  readonly channel: string;
  readonly templateUuid?: string;
  readonly recipient?: string;
  readonly subject?: string;
  readonly body?: string;
}

export interface AutomationCrmPort {
  getLead(uuid: string): Promise<AutomationLeadContext>;
  getActivity(uuid: string): Promise<Record<string, unknown>>;
  getLeadPreferences(uuid: string): Promise<Record<string, unknown>>;
  assignLead(
    uuid: string,
    userUuid: string,
    actor: AutomationActor,
  ): Promise<Record<string, unknown>>;
  refreshLeadScore(
    uuid: string,
    actor: AutomationActor,
  ): Promise<Record<string, unknown>>;
  createActivity(
    input: AutomationActivityInput,
    actor: AutomationActor,
  ): Promise<Record<string, unknown>>;
  enqueueCommunication(
    input: AutomationCommunicationInput,
    actor: AutomationActor,
  ): Promise<Record<string, unknown>>;
  deliverCommunication(
    uuid: string,
    actor: AutomationActor,
  ): Promise<Record<string, unknown>>;
  changeLeadStatus(
    uuid: string,
    statusUuid: string,
    actor: AutomationActor,
  ): Promise<Record<string, unknown>>;
}

export const CRM_AUTOMATION_PORT = Symbol('CRM_AUTOMATION_PORT');
