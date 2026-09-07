ALTER TABLE `system_activities`
  ADD COLUMN `retention_hold` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `retention_hold_until` DATETIME(3) NULL;

CREATE INDEX `system_activities_retention_hold_created_at_idx`
  ON `system_activities` (`retention_hold`, `created_at`);

CREATE INDEX `system_activities_retention_hold_until_created_at_idx`
  ON `system_activities` (`retention_hold_until`, `created_at`);

ALTER TABLE `audit_logs`
  ADD COLUMN `retention_hold` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `retention_hold_until` DATETIME(3) NULL;

CREATE INDEX `audit_logs_retention_hold_created_at_idx`
  ON `audit_logs` (`retention_hold`, `created_at`);

CREATE INDEX `audit_logs_retention_hold_until_created_at_idx`
  ON `audit_logs` (`retention_hold_until`, `created_at`);
