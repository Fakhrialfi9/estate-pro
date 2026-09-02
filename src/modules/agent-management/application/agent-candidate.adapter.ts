import { Injectable } from '@nestjs/common';
import type {
  AgentCandidatePort,
  AgentCandidateQuery,
} from '../../../common/contracts/agent-candidate.port.js';
import { AgentManagementService } from './agent-management.service.js';

@Injectable()
export class AgentCandidateAdapter implements AgentCandidatePort {
  constructor(private readonly agents: AgentManagementService) {}

  findCandidates(query: AgentCandidateQuery, requesterUuid?: string) {
    return this.agents.findCandidates(
      query,
      requesterUuid ? { uuid: requesterUuid } : undefined,
    ) as any;
  }
}
