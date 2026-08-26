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
];
