ALTER TABLE `system_integration_credentials`
  ADD COLUMN `access_token_ref` VARCHAR(255) NULL AFTER `secret_ref`,
  ADD COLUMN `refresh_token_ref` VARCHAR(255) NULL AFTER `access_token_ref`,
  ADD COLUMN `last_used_at` DATETIME(3) NULL AFTER `refresh_token_expires_at`;

CREATE INDEX `system_integration_credentials_refresh_expires_idx`
  ON `system_integration_credentials` (`refresh_token_expires_at`);
