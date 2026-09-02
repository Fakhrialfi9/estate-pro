INSERT INTO authorization_permissions (uuid, name, code, module, domain, action, created_at, updated_at)
VALUES
  (UUID(), 'Read Analytics', 'analytics.read', 'analytics', 'analytics', 'read', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (UUID(), 'Read All Analytics', 'analytics.read.all', 'analytics', 'analytics', 'read.all', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (UUID(), 'Read Revenue Analytics', 'analytics.revenue.read', 'analytics', 'revenue', 'read', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (UUID(), 'Export Analytics', 'analytics.export', 'analytics', 'analytics', 'export', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (UUID(), 'Forecast Analytics', 'analytics.forecast', 'analytics', 'forecast', 'read', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (UUID(), 'Manage Analytics', 'analytics.manage', 'analytics', 'analytics', 'manage', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), module = VALUES(module), domain = VALUES(domain), action = VALUES(action), updated_at = CURRENT_TIMESTAMP;

INSERT IGNORE INTO authorization_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authorization_roles r
JOIN authorization_permissions p ON p.code IN (
  'analytics.read', 'analytics.read.all', 'analytics.revenue.read',
  'analytics.export', 'analytics.forecast', 'analytics.manage'
)
WHERE r.code = 'ADMIN';
