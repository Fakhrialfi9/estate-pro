import type { PermissionSeed } from './types.ts';

export const PROPERTY_MATCHING_PERMISSIONS: readonly PermissionSeed[] = [
  {
    name: 'Read Property Matching Rules',
    code: 'property-matching.rules.read',
    module: 'property-matching',
    domain: 'matching-rules',
    action: 'read',
  },
  {
    name: 'Manage Property Matching Rules',
    code: 'property-matching.rules.manage',
    module: 'property-matching',
    domain: 'matching-rules',
    action: 'manage',
  },
];
