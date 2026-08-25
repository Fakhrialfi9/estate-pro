CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  actor_user_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  actor_type VARCHAR(24) NOT NULL DEFAULT 'SYSTEM',
  entity_type VARCHAR(100) NULL,
  entity_id BIGINT UNSIGNED NULL,
  resource_id VARCHAR(100) NULL,
  result VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
  reason VARCHAR(100) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  request_id VARCHAR(100) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_logs_actor_user FOREIGN KEY (actor_user_id) REFERENCES authentication_users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES authentication_users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_audit_logs_actor_user_id (actor_user_id), INDEX idx_audit_logs_user_id (user_id), INDEX idx_audit_logs_action (action), INDEX idx_audit_logs_entity_type (entity_type), INDEX idx_audit_logs_entity_id (entity_id), INDEX idx_audit_logs_resource_id (resource_id), INDEX idx_audit_logs_result (result), INDEX idx_audit_logs_request_id (request_id), INDEX idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_id BIGINT UNSIGNED NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type VARCHAR(24) NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(100) NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS result VARCHAR(16) NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason VARCHAR(100) NULL;
ALTER TABLE audit_logs ADD INDEX IF NOT EXISTS idx_audit_logs_actor_user_id (actor_user_id);
ALTER TABLE audit_logs ADD INDEX IF NOT EXISTS idx_audit_logs_resource_id (resource_id);
ALTER TABLE audit_logs ADD INDEX IF NOT EXISTS idx_audit_logs_result (result);

CREATE TABLE IF NOT EXISTS audit_log_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  audit_log_id BIGINT UNSIGNED NOT NULL,
  field VARCHAR(100) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_log_changes_audit_log FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_audit_log_changes_audit_log_id (audit_log_id)
) ENGINE=InnoDB;
