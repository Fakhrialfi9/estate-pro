export const AGENT_MANAGEMENT_PERMISSIONS = [
  { name: 'Access Agent Management', code: 'agents.access', module: 'agent-management', domain: 'agents', action: 'access' },
  { name: 'Read Agents', code: 'agents.read', module: 'agent-management', domain: 'agents', action: 'read' },
  { name: 'Manage Agents', code: 'agents.manage', module: 'agent-management', domain: 'agents', action: 'manage' },
  { name: 'Manage Agent Specializations', code: 'agents.specialization.manage', module: 'agent-management', domain: 'agents', action: 'specialization.manage' },
  { name: 'Manage Agent Locations', code: 'agents.location.manage', module: 'agent-management', domain: 'agents', action: 'location.manage' },
  { name: 'Manage Agent Availability', code: 'agents.availability.manage', module: 'agent-management', domain: 'agents', action: 'availability.manage' },
  { name: 'Self Assign Property', code: 'agents.assignment.self', module: 'agent-management', domain: 'agents', action: 'assignment.self' },
  { name: 'Manage Agent Assignments', code: 'agents.assignment.manage', module: 'agent-management', domain: 'agents', action: 'assignment.manage' },
  { name: 'Read Agent Targets', code: 'agents.target.read', module: 'agent-management', domain: 'agents', action: 'target.read' },
  { name: 'Manage Agent Targets', code: 'agents.target.manage', module: 'agent-management', domain: 'agents', action: 'target.manage' },
  { name: 'Read Agent Performance', code: 'agents.performance.read', module: 'agent-management', domain: 'agents', action: 'performance.read' },
] as const;
