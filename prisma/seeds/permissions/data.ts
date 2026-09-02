export type PermissionSeed = {
  name: string;
  code: string;
  module: string;
  domain: string;
  action: string;
};

export const PERMISSIONS: readonly PermissionSeed[] = [
  { name: 'View Users', code: 'users.read', module: 'users', domain: 'users', action: 'read' },
  { name: 'Create Users', code: 'users.create', module: 'users', domain: 'users', action: 'create' },
  { name: 'Update Users', code: 'users.update', module: 'users', domain: 'users', action: 'update' },
  { name: 'Delete Users', code: 'users.delete', module: 'users', domain: 'users', action: 'delete' },
  { name: 'View Roles', code: 'roles.read', module: 'roles', domain: 'roles', action: 'read' },
  { name: 'Create Roles', code: 'roles.create', module: 'roles', domain: 'roles', action: 'create' },
  { name: 'Update Roles', code: 'roles.update', module: 'roles', domain: 'roles', action: 'update' },
  { name: 'Delete Roles', code: 'roles.delete', module: 'roles', domain: 'roles', action: 'delete' },
  { name: 'Manage Roles', code: 'roles.manage', module: 'roles', domain: 'roles', action: 'manage' },
  { name: 'View Permissions', code: 'permissions.read', module: 'permissions', domain: 'permissions', action: 'read' },
  { name: 'Create Permissions', code: 'permissions.create', module: 'permissions', domain: 'permissions', action: 'create' },
  { name: 'Update Permissions', code: 'permissions.update', module: 'permissions', domain: 'permissions', action: 'update' },
  { name: 'Delete Permissions', code: 'permissions.delete', module: 'permissions', domain: 'permissions', action: 'delete' },
  { name: 'Manage Permissions', code: 'permissions.manage', module: 'permissions', domain: 'permissions', action: 'manage' },
  { name: 'Manage Protected Roles', code: 'roles.manage.protected', module: 'roles', domain: 'manage', action: 'protected' },
  { name: 'Manage Protected Permissions', code: 'permissions.manage.protected', module: 'permissions', domain: 'manage', action: 'protected' },
  { name: 'Create Property Types', code: 'property-types.create', module: 'property', domain: 'property-types', action: 'create' },
  { name: 'Read Property Types', code: 'property-types.read', module: 'property', domain: 'property-types', action: 'read' },
  { name: 'Update Property Types', code: 'property-types.update', module: 'property', domain: 'property-types', action: 'update' },
  { name: 'Delete Property Types', code: 'property-types.delete', module: 'property', domain: 'property-types', action: 'delete' },
  { name: 'Unpublish Listings', code: 'listings.unpublish', module: 'property', domain: 'listings', action: 'unpublish' },
  { name: 'Archive Listings', code: 'listings.archive', module: 'property', domain: 'listings', action: 'archive' },
  { name: 'Restore Listings', code: 'listings.restore', module: 'property', domain: 'listings', action: 'restore' },
  { name: 'Mark Listings Sold', code: 'listings.sold', module: 'property', domain: 'listings', action: 'sold' },
  { name: 'Mark Listings Rented', code: 'listings.rented', module: 'property', domain: 'listings', action: 'rented' },
  { name: 'Expire Listings', code: 'listings.expire', module: 'property', domain: 'listings', action: 'expire' },
  { name: 'Duplicate Listings', code: 'listings.duplicate', module: 'property', domain: 'listings', action: 'duplicate' },
  { name: 'Read Listing Analytics', code: 'listings.analytics.read', module: 'property', domain: 'listings', action: 'analytics.read' },
  { name: 'Read Automation Workflows', code: 'automation.workflows.read', module: 'automation', domain: 'workflows', action: 'read' },
  { name: 'Create Automation Workflows', code: 'automation.workflows.create', module: 'automation', domain: 'workflows', action: 'create' },
  { name: 'Update Automation Workflows', code: 'automation.workflows.update', module: 'automation', domain: 'workflows', action: 'update' },
  { name: 'Publish Automation Workflows', code: 'automation.workflows.publish', module: 'automation', domain: 'workflows', action: 'publish' },
  { name: 'Activate Automation Workflows', code: 'automation.workflows.activate', module: 'automation', domain: 'workflows', action: 'activate' },
  { name: 'Pause Automation Workflows', code: 'automation.workflows.pause', module: 'automation', domain: 'workflows', action: 'pause' },
  { name: 'Archive Automation Workflows', code: 'automation.workflows.archive', module: 'automation', domain: 'workflows', action: 'archive' },
  { name: 'Execute Automation', code: 'automation.execute', module: 'automation', domain: 'execution', action: 'execute' },
  { name: 'Read Automation Executions', code: 'automation.executions.read', module: 'automation', domain: 'execution', action: 'read' },
  { name: 'Retry Automation Executions', code: 'automation.executions.retry', module: 'automation', domain: 'execution', action: 'retry' },
  { name: 'Cancel Automation Executions', code: 'automation.executions.cancel', module: 'automation', domain: 'execution', action: 'cancel' },
];
