import { Injectable } from '@nestjs/common';
import type { CrmActor } from '../../domain/crm.types.js';
import type { AutomationActor } from '../../../../common/contracts/automation-actor.js';
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
  const item = asRecord(value);
  return typeof item.code === 'string' ? item.code : null;
};
const toCrmActor = (actor: AutomationActor): CrmActor => ({
  actorUuid: actor.actorUuid,
  permissions: [...actor.permissions],
  requestId: actor.requestId,
  ipAddress: actor.ipAddress,
  userAgent: actor.userAgent,
});

@Injectable()
export class CrmAutomationAdapter implements AutomationCrmPort {
  constructor(private readonly crm: CrmService) {}
  async getLead(uuid: string): Promise<AutomationLeadContext> {
    const lead = asRecord(await this.crm.getLead(uuid));
    return {
      uuid,
      contactUuid:
        typeof lead.contactUuid === 'string' ? lead.contactUuid : null,
      status: codeOf(lead.status),
      source: codeOf(lead.source),
      type: codeOf(lead.type),
      ownerUserUuid:
        typeof lead.ownerUserUuid === 'string' ? lead.ownerUserUuid : null,
      score: typeof lead.score === 'number' ? lead.score : null,
      createdAt:
        lead.createdAt instanceof Date ? lead.createdAt.toISOString() : null,
      updatedAt:
        lead.updatedAt instanceof Date ? lead.updatedAt.toISOString() : null,
    };
  }
  async getActivity(uuid: string) {
    return asRecord(await this.crm.activityGet(uuid));
  }
  async getLeadPreferences(uuid: string) {
    const lead = asRecord(await this.crm.getLead(uuid));
    return asRecord(asRecord(lead.contact).preferences);
  }
  assignLead(uuid: string, userUuid: string, actor: AutomationActor) {
    return this.crm.assign(uuid, userUuid, toCrmActor(actor)).then(asRecord);
  }
  refreshLeadScore(uuid: string, actor: AutomationActor) {
    return this.crm.recalcScore(uuid, toCrmActor(actor)).then(asRecord);
  }
  createActivity(input: AutomationActivityInput, actor: AutomationActor) {
    return this.crm
      .activityCreate({ ...input }, toCrmActor(actor))
      .then(asRecord);
  }
  enqueueCommunication(
    input: AutomationCommunicationInput,
    actor: AutomationActor,
  ) {
    return this.crm
      .communicationCreate({ ...input }, toCrmActor(actor))
      .then(asRecord);
  }
  changeLeadStatus(uuid: string, statusUuid: string, actor: AutomationActor) {
    return this.crm
      .changeStatus(uuid, statusUuid, toCrmActor(actor))
      .then(asRecord);
  }
}
