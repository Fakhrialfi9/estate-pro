-- Bootstrap protected authorization capabilities that are intentionally
-- not creatable through the regular permission CRUD API.
--
-- Protected permissions are represented by the canonical dotted codes:
--   roles.manage.protected
--   permissions.manage.protected
--
-- The migration is idempotent so it is safe for development databases that
-- may already contain one of the records.

INSERT INTO authorization_permissions (
    uuid,
    name,
    code,
    module,
    domain,
    action,
    created_at,
    updated_at
)
SELECT
    'b4d4b9a6-7f16-4db3-9e9d-2f07ad5c9a01',
    'Manage Protected Roles',
    'roles.manage.protected',
    'roles',
    'manage',
    'protected',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
    SELECT 1
    FROM authorization_permissions
    WHERE code = 'roles.manage.protected'
);

INSERT INTO authorization_permissions (
    uuid,
    name,
    code,
    module,
    domain,
    action,
    created_at,
    updated_at
)
SELECT
    'b4d4b9a6-7f16-4db3-9e9d-2f07ad5c9a02',
    'Manage Protected Permissions',
    'permissions.manage.protected',
    'permissions',
    'manage',
    'protected',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
    SELECT 1
    FROM authorization_permissions
    WHERE code = 'permissions.manage.protected'
);

-- ADMIN is the bootstrap administrative role. Grant both protected
-- capabilities so the administrator can operate the protected RBAC surface
-- without exposing creation of system permissions through public CRUD.
INSERT INTO authorization_role_permissions (
    role_id,
    permission_id,
    created_at,
    updated_at
)
SELECT
    role.id,
    permission.id,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM authorization_roles AS role
CROSS JOIN authorization_permissions AS permission
WHERE role.code = 'ADMIN'
  AND permission.code IN (
      'roles.manage.protected',
      'permissions.manage.protected'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM authorization_role_permissions AS existing
      WHERE existing.role_id = role.id
        AND existing.permission_id = permission.id
  );
