CREATE TABLE `property_listing_analytics` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `view_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `inquiry_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `share_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `save_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_listing_analytics_listing_id_key` (`listing_id`),
  CONSTRAINT `property_listing_analytics_listing_fk` FOREIGN KEY (`listing_id`) REFERENCES `property_listings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `property_listing_engagements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `user_uuid` CHAR(36) NOT NULL,
  `is_saved` BOOLEAN NOT NULL DEFAULT false,
  `viewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_listing_engagements_uuid_key` (`uuid`),
  UNIQUE KEY `property_listing_engagements_listing_user_key` (`listing_id`,`user_uuid`),
  KEY `property_listing_engagements_user_saved_idx` (`user_uuid`,`is_saved`),
  CONSTRAINT `property_listing_engagements_listing_fk` FOREIGN KEY (`listing_id`) REFERENCES `property_listings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;