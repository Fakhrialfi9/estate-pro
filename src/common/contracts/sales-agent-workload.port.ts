export type SalesAgentWorkload = {
  openOpportunities: number;
  openDeals: number;
  salesValue: number;
};

export interface SalesAgentWorkloadPort {
  getWorkload(agentUserUuid: string): Promise<SalesAgentWorkload>;
}

export const SALES_AGENT_WORKLOAD_PORT = Symbol('SALES_AGENT_WORKLOAD_PORT');
