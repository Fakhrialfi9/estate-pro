-- Property Management bulk-permission migration (20260828000000_property_management_permissions)
-- already provisions the base CRUD permissions below. This migration only owns
-- the media-specific actions introduced here to keep migration ownership unique.

INSERT INTO authorization_permissions
    (uuid, name, code, module, domain, action, created_at, updated_at)
VALUES
    (UUID(), 'Set Property Media Cover', 'property-media.set-cover', 'property', 'property-media', 'set-cover', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'Reorder Property Media', 'property-media.reorder', 'property', 'property-media', 'reorder', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    module = VALUES(module),
    domain = VALUES(domain),
    action = VALUES(action),
    updated_at = CURRENT_TIMESTAMP(3);

INSERT INTO authorization_role_permissions (role_id, permission_id, created_at, updated_at)
SELECT
    r.id,
    p.id,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM authorization_roles r
CROSS JOIN authorization_permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN (
      'property-media.set-cover',
      'property-media.reorder'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM authorization_role_permissions x
      WHERE x.role_id = r.id
        AND x.permission_id = p.id
  );
