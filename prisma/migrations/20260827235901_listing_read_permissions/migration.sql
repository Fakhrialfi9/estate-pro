INSERT INTO authorization_permissions (uuid,name,code,module,domain,action,created_at,updated_at)
SELECT UUID(), x.name, x.code, 'property', x.domain, x.action, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
  SELECT 'Read Sensitive Property Data' name, 'properties.sensitive.read' code, 'properties' domain, 'sensitive-read' action
  UNION ALL SELECT 'Read Listing Analytics', 'listings.analytics.read', 'listings', 'analytics-read'
) x
WHERE NOT EXISTS (SELECT 1 FROM authorization_permissions p WHERE p.code = x.code);
INSERT INTO authorization_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
FROM authorization_roles r CROSS JOIN authorization_permissions p
WHERE r.code='ADMIN' AND p.code IN ('properties.sensitive.read','listings.analytics.read')
AND NOT EXISTS (SELECT 1 FROM authorization_role_permissions x WHERE x.role_id=r.id AND x.permission_id=p.id);
