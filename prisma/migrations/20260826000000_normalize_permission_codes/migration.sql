-- Normalize permission identifiers to the canonical dotted format.
-- Regular capabilities use module.action; protected capabilities use
-- module.manage.protected.

UPDATE authorization_permissions
SET code = 'roles.manage'
WHERE code = 'roles:roles:manage'
  AND module = 'roles'
  AND domain = 'roles'
  AND action = 'manage';

UPDATE authorization_permissions
SET code = 'roles.manage.protected'
WHERE code = 'roles:manage:protected'
  AND module = 'roles'
  AND domain = 'manage'
  AND action = 'protected';

UPDATE authorization_permissions
SET code = 'permissions.manage.protected'
WHERE code = 'permissions:manage:protected'
  AND module = 'permissions'
  AND domain = 'manage'
  AND action = 'protected';
