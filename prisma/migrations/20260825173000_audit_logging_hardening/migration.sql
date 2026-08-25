-- Harden the Phase 1 audit logging tables that already exist in the baseline.
-- This migration intentionally applies only additive schema changes.

ALTER TABLE `audit_logs`
  ADD COLUMN `actor_user_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `actor_type` VARCHAR(24) NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN `resource_id` VARCHAR(100) NULL,
  ADD COLUMN `result` VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN `reason` VARCHAR(100) NULL,
  ADD INDEX `idx_audit_logs_actor_user_id` (`actor_user_id`),
  ADD INDEX `idx_audit_logs_resource_id` (`resource_id`),
  ADD INDEX `idx_audit_logs_result` (`result`),
  ADD CONSTRAINT `fk_audit_logs_actor_user`
    FOREIGN KEY (`actor_user_id`) REFERENCES `authentication_users` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
