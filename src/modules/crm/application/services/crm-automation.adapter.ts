import { Injectable } from '@nestjs/common';
import type { CrmActor } from '../../domain/crm.types.js';
import type {
  AutomationActivityInput,
  AutomationCommunicationInput,
  AutomationCrmPort,
  AutomationLeadContext,
} from '../../../../common/contracts/automation-crm.port.js';
import { CrmService } from '../crm.service.js';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const codeOf = (value: unknown): string | null => {
  const record = asRecord(value);
  return typeof record.code === 'string' ? record.code : null;
};

@Injectable()
export class CrmAutomationAdapter implements AutomationCrmPort {
  constructor(private readonly crm: CrmService) {}

  async getLead(uuid: string): Promise<AutomationLeadContext> {
    const lead = asRecord(await this.crm.getLead(uuid));
    return {
      uuid,
      contactUuid: typeof lead.contactUuid === 'string' ? lead.contactUuid : null,
      status: codeOf(lead.status),
      source: codeOf(lead.source),
      type: codeOf(lead.type),
      ownerUserUuid:
        typeof lead.ownerUserUuid === 'string' ? lead.ownerUserUuid : null,
      score: typeof lead.score === 'number' ? lead.score : null,
      createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : null,
      updatedAt: lead.updatedAt instanceof Date ? lead.updatedAt.toISOString() : null,
    };
  }

  async getActivity(uuid: string): Promise<Record<string, unknown>> {
    return asRecord(await this.crm.activityGet(uuid));
  }

  async getLeadPreferences(uuid: string): Promise<Record<string, unknown>> {
    const lead = asRecord(await this.crm.getLead(uuid));
    const contact = asRecord(lead.contact);
    return asRecord(contact.preferences);
  }

  assignLead(uuid: string, userUuid: string, actor: CrmActor) {
    return this.crm.assign(uuid, userUuid, actor).then(asRecord);
  }

  refreshLeadScore(uuid: string, actor: CrmActor) {
    return this.crm.recalcScore(uuid, actor).then(asRecord);
  }

  createActivity(input: AutomationActivityInput, actor: CrmActor) {
    return this.crm.activityCreate({ ...input }, actor).then(asRecord);
  }

  enqueueCommunication(input: AutomationCommunicationInput, actor: CrmActor) {
    return this.crm.communicationCreate({ ...input }, actor).then(asRecord);
  }
}
