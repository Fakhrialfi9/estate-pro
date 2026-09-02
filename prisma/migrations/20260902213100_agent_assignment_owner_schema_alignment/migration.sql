ALTER TABLE `property_agent_assignments`
  ADD COLUMN `agent_display_name` VARCHAR(160) NOT NULL DEFAULT '' AFTER `agent_user_uuid`,
  ADD COLUMN `is_primary` BOOLEAN NOT NULL DEFAULT FALSE AFTER `agent_display_name`,
  ADD COLUMN `created_by` CHAR(36) NULL AFTER `unassigned_at`,
  ADD COLUMN `updated_by` CHAR(36) NULL AFTER `created_by`,
  DROP COLUMN `assigned_by_uuid`,
  DROP COLUMN `unassigned_by_uuid`,
  DROP COLUMN `reason`,
  DROP COLUMN `version`;

ALTER TABLE `property_agent_assignments`
  DROP INDEX `property_agent_assignments_agent_active_idx`,
  DROP INDEX `property_agent_assignments_property_active_idx`,
  ADD INDEX `property_agent_assignments_agent_active_idx` (`agent_user_uuid`,`unassigned_at`),
  ADD INDEX `property_agent_assignments_property_primary_active_idx` (`property_id`,`is_primary`,`unassigned_at`);
