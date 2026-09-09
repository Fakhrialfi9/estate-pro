import { ADMIN_ROLE } from '../config.ts';

export const ROLES = [
  ADMIN_ROLE,
  {
    name: 'Manager',
    code: 'MANAGER',
    description: 'Sales and team management access for development and testing.',
  },
  {
    name: 'Sales',
    code: 'SALES',
    description: 'Sales workflow access for development and testing.',
  },
  {
    name: 'Agent',
    code: 'AGENT',
    description: 'Property agent access for development and testing.',
  },
  {
    name: 'Staff',
    code: 'STAFF',
    description: 'Operational staff access for development and testing.',
  },
] as const;
