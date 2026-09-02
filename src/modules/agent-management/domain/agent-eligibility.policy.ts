export type AgentEligibilityUser = { uuid: string; status: string; isActive: boolean; deletedAt: Date | null };
export type AgentEligibilitySnapshot = { user: AgentEligibilityUser | null; hasAgentAccess: boolean; agentStatus?: string };
export const isUserEligibleForAgent = (snapshot: AgentEligibilitySnapshot): boolean => Boolean(snapshot.user && snapshot.user.deletedAt === null && snapshot.user.isActive && !['inactive','suspended','deleted','disabled'].includes(snapshot.user.status.toLowerCase()) && snapshot.hasAgentAccess);
export const isAgentAssignable = (snapshot: AgentEligibilitySnapshot, availability: string, remainingCapacity: number): boolean => isUserEligibleForAgent(snapshot) && snapshot.agentStatus === 'ACTIVE' && availability === 'ACTIVE' && remainingCapacity > 0;
