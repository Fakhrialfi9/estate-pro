CREATE TABLE `authentication_refresh_token_families` (
  `id` CHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `session_id` BIGINT UNSIGNED NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `revoke_reason` VARCHAR(40) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `authentication_refresh_token_families_user_id_revoked_at_idx` (`user_id`, `revoked_at`),
  INDEX `authentication_refresh_token_families_session_id_revoked_at_idx` (`session_id`, `revoked_at`),
  INDEX `authentication_refresh_token_families_revoked_at_idx` (`revoked_at`),
  CONSTRAINT `authentication_refresh_token_families_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `authentication_users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `authentication_refresh_token_families_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `authentication_user_sessions` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `authentication_refresh_token_families_revoke_reason_chk`
    CHECK (`revoke_reason` IS NULL OR `revoke_reason` IN (
      'LOGOUT','ROTATED','REUSE_DETECTED','PASSWORD_CHANGED','PASSWORD_RESET',
      'SECURITY_EVENT','ADMIN_REVOKED','SESSION_REVOKED','ACCOUNT_DISABLED',
      'ACCOUNT_SUSPENDED','ACCOUNT_DELETED','ACCOUNT_LOCKED'
    ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `authentication_refresh_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `family_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `issued_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `consumed_at` DATETIME(3) NULL,
  `revoked_at` DATETIME(3) NULL,
  `revoke_reason` VARCHAR(40) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `authentication_refresh_tokens_token_hash_key` (`token_hash`),
  INDEX `authentication_refresh_tokens_family_id_idx` (`family_id`),
  INDEX `authentication_refresh_tokens_expires_at_idx` (`expires_at`),
  INDEX `authentication_refresh_tokens_consumed_at_idx` (`consumed_at`),
  INDEX `authentication_refresh_tokens_revoked_at_idx` (`revoked_at`),
  CONSTRAINT `authentication_refresh_tokens_family_id_fkey`
    FOREIGN KEY (`family_id`) REFERENCES `authentication_refresh_token_families` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `authentication_refresh_tokens_revoke_reason_chk`
    CHECK (`revoke_reason` IS NULL OR `revoke_reason` IN (
      'LOGOUT','ROTATED','REUSE_DETECTED','PASSWORD_CHANGED','PASSWORD_RESET',
      'SECURITY_EVENT','ADMIN_REVOKED','SESSION_REVOKED','ACCOUNT_DISABLED',
      'ACCOUNT_SUSPENDED','ACCOUNT_DELETED','ACCOUNT_LOCKED'
    ))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
