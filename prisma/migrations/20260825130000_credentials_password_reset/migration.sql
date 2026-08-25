CREATE TABLE `authentication_password_reset_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `token_digest` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `authentication_password_reset_tokens_token_digest_key` (`token_digest`),
  KEY `authentication_password_reset_tokens_user_id_idx` (`user_id`),
  KEY `authentication_password_reset_tokens_expires_at_idx` (`expires_at`),
  KEY `authentication_password_reset_tokens_used_at_idx` (`used_at`),
  KEY `authentication_password_reset_tokens_user_exp_used_idx` (`user_id`, `expires_at`, `used_at`),
  CONSTRAINT `authentication_password_reset_tokens_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `authentication_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
