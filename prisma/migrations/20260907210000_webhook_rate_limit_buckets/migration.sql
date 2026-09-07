CREATE TABLE `system_webhook_rate_limit_buckets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `subscription_id` BIGINT UNSIGNED NOT NULL,
  `bucket_start` DATETIME(3) NOT NULL,
  `request_count` INT NOT NULL DEFAULT 0,
  `blocked_count` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_webhook_rate_bucket_key` (`subscription_id`,`bucket_start`),
  KEY `system_webhook_rate_bucket_start_idx` (`bucket_start`),
  CONSTRAINT `system_webhook_rate_limit_buckets_subscription_id_fk`
    FOREIGN KEY (`subscription_id`) REFERENCES `system_webhook_subscriptions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
