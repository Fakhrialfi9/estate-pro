export type CrmAgentWorkload = {
  assignedLeads: number;
  closedLeads: number;
};

export interface CrmAgentWorkloadPort {
  getWorkload(agentUserUuid: string): Promise<CrmAgentWorkload>;
}

export const CRM_AGENT_WORKLOAD_PORT = Symbol('CRM_AGENT_WORKLOAD_PORT');
