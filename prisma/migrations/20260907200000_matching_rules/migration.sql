CREATE TABLE `matching_rules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `version` INT NOT NULL,
  `weights` JSON NOT NULL,
  `hard_criteria` JSON NOT NULL,
  `minimum_score` DECIMAL(6,2) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_by` CHAR(36) NOT NULL,
  `activated_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `matching_rules_uuid_key` (`uuid`),
  UNIQUE KEY `matching_rules_name_version_key` (`name`,`version`),
  KEY `matching_rules_active_version_idx` (`is_active`,`version`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
