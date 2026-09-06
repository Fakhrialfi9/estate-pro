import { AGENT_MANAGEMENT_PERMISSIONS } from './agent-management.ts';
import { ANALYTICS_PERMISSIONS } from './analytics.ts';
import { AUTOMATION_PERMISSIONS } from './automation.ts';
import { CONTENT_EXTRA_PERMISSIONS, CONTENT_PERMISSIONS } from './content.ts';
import { CRM_PERMISSIONS } from './crm.ts';
import { PROPERTY_PERMISSIONS } from './property.ts';
import { SALES_PERMISSIONS } from './sales.ts';
import { SYSTEM_PERMISSIONS } from './system.ts';
import { USER_PERMISSIONS } from './users.ts';
import type { PermissionSeed } from './types.ts';

export type { PermissionSeed } from './types.ts';

export const PERMISSIONS: readonly PermissionSeed[] = [
  ...USER_PERMISSIONS,
  ...PROPERTY_PERMISSIONS,
  ...AUTOMATION_PERMISSIONS,
  ...SYSTEM_PERMISSIONS,
  ...CONTENT_PERMISSIONS,
  ...CONTENT_EXTRA_PERMISSIONS,
  ...CRM_PERMISSIONS,
  ...SALES_PERMISSIONS,
  ...AGENT_MANAGEMENT_PERMISSIONS,
  ...ANALYTICS_PERMISSIONS,
];
