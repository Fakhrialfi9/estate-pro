INSERT INTO authorization_permissions
  (uuid, name, code, module, domain, action, created_at, updated_at)
SELECT UUID(), v.name, v.code, 'property', v.domain, v.action, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
  SELECT 'Verify Properties' AS name, 'properties.verify' AS code, 'properties' AS domain, 'verify' AS action
  UNION ALL SELECT 'Publish Properties', 'properties.publish', 'properties', 'publish'
  UNION ALL SELECT 'Archive Properties', 'properties.archive', 'properties', 'archive'
  UNION ALL SELECT 'Manage Properties', 'properties.manage', 'properties', 'manage'
  UNION ALL SELECT 'Read Sensitive Property Data', 'properties.sensitive.read', 'properties', 'sensitive.read'
  UNION ALL SELECT 'Assign Property Agent', 'property-agents.assign', 'property-agents', 'assign'
  UNION ALL SELECT 'Change Property Agent', 'property-agents.change', 'property-agents', 'change'
  UNION ALL SELECT 'Manage Property Owners', 'property-owners.manage', 'property-owners', 'manage'
) AS v
WHERE NOT EXISTS (
  SELECT 1
  FROM authorization_permissions p
  WHERE p.code = v.code
);

INSERT INTO authorization_role_permissions
  (role_id, permission_id, created_at, updated_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM authorization_roles r
CROSS JOIN authorization_permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN (
    'properties.verify',
    'properties.publish',
    'properties.archive',
    'properties.manage',
    'properties.sensitive.read',
    'property-agents.assign',
    'property-agents.change',
    'property-owners.manage'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM authorization_role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
