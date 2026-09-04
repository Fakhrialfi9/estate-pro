ALTER TABLE `system_export_jobs`
  ADD COLUMN `estimated_rows` INT NULL,
  ADD COLUMN `processed_rows` INT NOT NULL DEFAULT 0,
  ADD COLUMN `completed_at` DATETIME(3) NULL,
  ADD COLUMN `cancelled_at` DATETIME(3) NULL,
  ADD COLUMN `cancel_requested` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `artifact_bytes` BIGINT UNSIGNED NULL;

CREATE INDEX `system_export_jobs_cancel_requested_state_idx`
  ON `system_export_jobs` (`cancel_requested`, `state`);

CREATE TABLE `system_webhook_subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `endpoint` VARCHAR(2048) NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `events` JSON NOT NULL,
  `secret_ciphertext` TEXT NOT NULL,
  `secret_version` INT NOT NULL DEFAULT 1,
  `secret_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_webhook_subscriptions_uuid_key` (`uuid`),
  KEY `system_webhook_subscriptions_status_created_at_idx` (`status`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `system_webhook_deliveries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `subscription_id` BIGINT UNSIGNED NOT NULL,
  `event_name` VARCHAR(120) NOT NULL,
  `event_version` INT NOT NULL DEFAULT 1,
  `payload_hash` CHAR(64) NOT NULL,
  `attempt_count` INT NOT NULL DEFAULT 0,
  `state` VARCHAR(24) NOT NULL,
  `http_status` INT NULL,
  `response_summary` VARCHAR(500) NULL,
  `next_attempt_at` DATETIME(3) NULL,
  `signed_at` DATETIME(3) NOT NULL,
  `completed_at` DATETIME(3) NULL,
  `failure_reason` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_webhook_deliveries_uuid_key` (`uuid`),
  KEY `system_webhook_deliveries_subscription_created_at_idx` (`subscription_id`, `created_at`),
  KEY `system_webhook_deliveries_state_next_attempt_at_idx` (`state`, `next_attempt_at`),
  KEY `system_webhook_deliveries_payload_hash_idx` (`payload_hash`),
  CONSTRAINT `system_webhook_deliveries_subscription_id_fk`
    FOREIGN KEY (`subscription_id`) REFERENCES `system_webhook_subscriptions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `system_integrations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `provider_key` VARCHAR(80) NOT NULL,
  `provider_version` VARCHAR(40) NOT NULL,
  `capabilities` JSON NOT NULL,
  `state` VARCHAR(24) NOT NULL,
  `metadata` JSON NOT NULL,
  `secret_ref` VARCHAR(255) NULL,
  `last_test_at` DATETIME(3) NULL,
  `last_sync_at` DATETIME(3) NULL,
  `error_code` VARCHAR(80) NULL,
  `error_message` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_integrations_uuid_key` (`uuid`),
  UNIQUE KEY `system_integrations_provider_version_key` (`provider_key`, `provider_version`),
  KEY `system_integrations_state_updated_at_idx` (`state`, `updated_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
