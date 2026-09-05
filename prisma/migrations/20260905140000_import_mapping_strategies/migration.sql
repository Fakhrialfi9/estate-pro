ALTER TABLE `system_import_jobs`
  ADD COLUMN `column_mapping` JSON NOT NULL DEFAULT '[]',
  ADD COLUMN `field_mapping` JSON NOT NULL DEFAULT '[]',
  ADD COLUMN `conflict_strategy` VARCHAR(16) NOT NULL DEFAULT 'FAIL',
  ADD COLUMN `transaction_strategy` VARCHAR(24) NOT NULL DEFAULT 'ROW';
