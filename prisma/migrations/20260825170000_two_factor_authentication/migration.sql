-- Add secure 2FA state, recovery codes, and one-time login challenges.
ALTER TABLE `authentication_user_two_factors`
  ADD COLUMN `enrollment_started_at` DATETIME NULL,
  ADD COLUMN `last_used_time_step` BIGINT UNSIGNED NULL,
  ADD COLUMN `failed_verification_attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `locked_until` DATETIME NULL;

CREATE TABLE `authentication_user_two_factor_recovery_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `authentication_user_two_factor_recovery_codes_user_id_used_at_idx` (`user_id`, `used_at`),
  CONSTRAINT `authentication_user_two_factor_recovery_codes_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `authentication_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `authentication_user_two_factor_challenges` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `challenge_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME NULL,
  `failed_attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `authentication_user_two_factor_challenges_challenge_hash_key` (`challenge_hash`),
  KEY `authentication_user_two_factor_challenges_user_id_expires_at_idx` (`user_id`, `expires_at`),
  KEY `authentication_user_two_factor_challenges_consumed_at_idx` (`consumed_at`),
  CONSTRAINT `authentication_user_two_factor_challenges_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `authentication_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
