CREATE TABLE `automation_notification_templates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `titleTemplate` VARCHAR(180) NOT NULL,
  `bodyTemplate` TEXT NOT NULL,
  `variables` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_notification_templates_uuid_key` (`uuid`),
  UNIQUE KEY `automation_notification_templates_code_version_key` (`code`, `version`),
  KEY `automation_notification_templates_code_isActive_idx` (`code`, `isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_notification_preferences` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `userUuid` CHAR(36) NOT NULL,
  `notificationType` VARCHAR(50) NOT NULL,
  `channel` VARCHAR(20) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_notification_preferences_uuid_key` (`uuid`),
  UNIQUE KEY `automation_notification_preferences_user_type_channel_key` (`userUuid`, `notificationType`, `channel`),
  KEY `automation_notification_preferences_user_enabled_idx` (`userUuid`, `enabled`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_notification_policies` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `notification_uuid` CHAR(36) NOT NULL,
  `template_uuid` CHAR(36) NULL,
  `priority` VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  `expires_at` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_notification_policies_uuid_key` (`uuid`),
  UNIQUE KEY `automation_notification_policies_notification_uuid_key` (`notification_uuid`),
  KEY `automation_notification_policies_priority_expires_at_idx` (`priority`, `expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_notification_deliveries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `notification_uuid` CHAR(36) NOT NULL,
  `channel` VARCHAR(20) NOT NULL,
  `state` VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  `attempt_count` INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 3,
  `available_at` DATETIME(3) NULL,
  `sent_at` DATETIME(3) NULL,
  `provider_message_id` VARCHAR(255) NULL,
  `error_message` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_notification_deliveries_uuid_key` (`uuid`),
  UNIQUE KEY `automation_notification_deliveries_notification_channel_key` (`notification_uuid`, `channel`),
  KEY `automation_notification_deliveries_state_available_created_idx` (`state`, `available_at`, `createdAt`),
  KEY `automation_notification_deliveries_channel_state_available_idx` (`channel`, `state`, `available_at`),
  CONSTRAINT `automation_notification_deliveries_notification_fk`
    FOREIGN KEY (`notification_uuid`) REFERENCES `automation_notifications` (`uuid`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
