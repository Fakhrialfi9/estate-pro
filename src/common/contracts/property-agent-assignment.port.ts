export type PropertyAgentAssignmentRecord = {
  uuid: string;
  propertyUuid: string;
  agentUserUuid: string;
  agentDisplayName: string;
  isPrimary: boolean;
  assignedAt: Date;
  unassignedAt: Date | null;
};

export interface PropertyAgentAssignmentPort {
  assign(input: { propertyUuid: string; agentUserUuid: string; agentDisplayName: string; actorUuid: string }): Promise<PropertyAgentAssignmentRecord>;
  unassign(input: { propertyUuid: string; agentUserUuid: string; actorUuid: string }): Promise<PropertyAgentAssignmentRecord>;
  reassign(input: { propertyUuid: string; fromAgentUserUuid?: string; toAgentUserUuid: string; toAgentDisplayName: string; actorUuid: string }): Promise<PropertyAgentAssignmentRecord>;
  isAssigned(propertyUuid: string, agentUserUuid: string): Promise<boolean>;
  listCurrent(agentUserUuid: string, limit: number, cursor?: string): Promise<PropertyAgentAssignmentRecord[]>;
  listHistory(agentUserUuid: string, limit: number): Promise<PropertyAgentAssignmentRecord[]>;
  countCurrent(agentUserUuid: string): Promise<number>;
}
export const PROPERTY_AGENT_ASSIGNMENT_PORT = Symbol('PROPERTY_AGENT_ASSIGNMENT_PORT');
