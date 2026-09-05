ALTER TABLE `system_import_jobs`
  ADD COLUMN `column_mapping` JSON NULL,
  ADD COLUMN `field_mapping` JSON NULL,
  ADD COLUMN `conflict_strategy` VARCHAR(16) NOT NULL DEFAULT 'FAIL',
  ADD COLUMN `transaction_strategy` VARCHAR(24) NOT NULL DEFAULT 'ROW';

UPDATE `system_import_jobs`
SET
  `column_mapping` = '[]',
  `field_mapping` = '[]'
WHERE `column_mapping` IS NULL OR `field_mapping` IS NULL;

ALTER TABLE `system_import_jobs`
  MODIFY COLUMN `column_mapping` JSON NOT NULL,
  MODIFY COLUMN `field_mapping` JSON NOT NULL;
