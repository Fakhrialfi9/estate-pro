INSERT INTO authorization_permissions (uuid, name, code, module, domain, action)
VALUES
  (UUID(), 'Read Analytics', 'analytics.read', 'analytics', 'analytics', 'read'),
  (UUID(), 'Read All Analytics', 'analytics.read.all', 'analytics', 'analytics', 'read.all'),
  (UUID(), 'Read Revenue Analytics', 'analytics.revenue.read', 'analytics', 'revenue', 'read'),
  (UUID(), 'Export Analytics', 'analytics.export', 'analytics', 'analytics', 'export'),
  (UUID(), 'Forecast Analytics', 'analytics.forecast', 'analytics', 'forecast', 'read'),
  (UUID(), 'Manage Analytics', 'analytics.manage', 'analytics', 'analytics', 'manage')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), module = VALUES(module), domain = VALUES(domain), action = VALUES(action);

INSERT IGNORE INTO authorization_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authorization_roles r
JOIN authorization_permissions p ON p.code IN (
  'analytics.read', 'analytics.read.all', 'analytics.revenue.read',
  'analytics.export', 'analytics.forecast', 'analytics.manage'
)
WHERE r.code = 'ADMIN';
