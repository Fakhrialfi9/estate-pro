export type AgentCandidate = {
  uuid: string;
  userUuid: string;
  displayName: string | null;
  specializations: string[];
  coverage: string[];
  availability: string;
  capacity: { max: number; current: number; remaining: number; utilizationPercent: number };
};
export type AgentCandidateQuery = { propertyUuid?: string; specializationUuid?: string; regionUuids?: string[]; limit?: number };
export interface AgentCandidatePort { findCandidates(query: AgentCandidateQuery, requesterUuid?: string): Promise<AgentCandidate[]>; }
export const AGENT_CANDIDATE_PORT = Symbol('AGENT_CANDIDATE_PORT');
