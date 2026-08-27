CREATE TABLE `property_listings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `listing_code` VARCHAR(80) NOT NULL,
  `transaction_type` ENUM('SALE','RENT','LEASE','AUCTION','JOINT_VENTURE','OTHER') NOT NULL,
  `status` ENUM('DRAFT','IN_REVIEW','VERIFIED','ACTIVE','PUBLISHED','UNPUBLISHED','EXPIRED','SOLD','RENTED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `visibility` ENUM('PUBLIC','PRIVATE','INTERNAL') NOT NULL DEFAULT 'PRIVATE',
  `featured` BOOLEAN NOT NULL DEFAULT FALSE,
  `premium` BOOLEAN NOT NULL DEFAULT FALSE,
  `verified_at` DATETIME(3) NULL,
  `verified_by` CHAR(36) NULL,
  `published_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NULL,
  `rejection_reason` VARCHAR(1000) NULL,
  `version` INT NOT NULL DEFAULT 1,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `property_listings_uuid_key` (`uuid`), UNIQUE KEY `property_listings_property_id_key` (`property_id`), UNIQUE KEY `property_listings_listing_code_key` (`listing_code`),
  KEY `property_listings_status_visibility_featured_expires_id_idx` (`status`,`visibility`,`featured`,`expires_at`,`id`),
  KEY `property_listings_transaction_status_visibility_id_idx` (`transaction_type`,`status`,`visibility`,`id`), KEY `property_listings_verified_at_idx` (`verified_at`), KEY `property_listings_published_at_idx` (`published_at`),
  CONSTRAINT `property_listings_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_listing_prices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `price_type` ENUM('TOTAL','PER_MONTH','PER_YEAR','PER_SQM','PER_DAY') NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `min_price` DECIMAL(24,2) NULL,
  `max_price` DECIMAL(24,2) NULL,
  `price_per_sqm` DECIMAL(24,4) NULL,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `property_listing_prices_uuid_key` (`uuid`), UNIQUE KEY `property_listing_prices_listing_id_key` (`listing_id`), KEY `property_listing_prices_currency_price_type_idx` (`currency`,`price_type`), KEY `property_listing_prices_min_max_idx` (`min_price`,`max_price`),
  CONSTRAINT `property_listing_prices_listing_fk` FOREIGN KEY (`listing_id`) REFERENCES `property_listings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_listing_payment_options` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `option_type` ENUM('CASH','MORTGAGE','INSTALLMENT','CASH_OR_MORTGAGE','OTHER') NOT NULL,
  `down_payment_amount` DECIMAL(24,2) NULL,
  `down_payment_percent` DECIMAL(7,4) NULL,
  `installment_amount` DECIMAL(24,2) NULL,
  `tenor_months` INT NULL,
  `notes` VARCHAR(500) NULL,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `property_listing_payment_options_uuid_key` (`uuid`), UNIQUE KEY `property_listing_payment_options_listing_option_key` (`listing_id`,`option_type`), KEY `property_listing_payment_options_type_tenor_idx` (`option_type`,`tenor_months`),
  CONSTRAINT `property_listing_payment_options_listing_fk` FOREIGN KEY (`listing_id`) REFERENCES `property_listings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_agent_assignments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `agent_user_uuid` CHAR(36) NOT NULL,
  `agent_display_name` VARCHAR(160) NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT FALSE,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `unassigned_at` DATETIME(3) NULL,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `property_agent_assignments_uuid_key` (`uuid`), UNIQUE KEY `property_agent_assignments_property_agent_key` (`property_id`,`agent_user_uuid`), KEY `property_agent_assignments_agent_active_idx` (`agent_user_uuid`,`unassigned_at`), KEY `property_agent_assignments_property_primary_active_idx` (`property_id`,`is_primary`,`unassigned_at`),
  CONSTRAINT `property_agent_assignments_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_owners` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `owner_type` ENUM('INDIVIDUAL','COMPANY','JOINT','GOVERNMENT','OTHER') NOT NULL,
  `display_name_masked` VARCHAR(160) NOT NULL,
  `reference_hash` CHAR(64) NULL,
  `company_name_masked` VARCHAR(160) NULL,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `property_owners_uuid_key` (`uuid`), UNIQUE KEY `property_owners_property_id_key` (`property_id`),
  CONSTRAINT `property_owners_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_listing_analytics` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `view_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `inquiry_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `share_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `save_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `property_listing_analytics_listing_id_key` (`listing_id`),
  CONSTRAINT `property_listing_analytics_listing_fk` FOREIGN KEY (`listing_id`) REFERENCES `property_listings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_listing_engagements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `user_uuid` CHAR(36) NOT NULL,
  `is_saved` BOOLEAN NOT NULL DEFAULT FALSE,
  `viewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `property_listing_engagements_uuid_key` (`uuid`), UNIQUE KEY `property_listing_engagements_listing_user_key` (`listing_id`,`user_uuid`), KEY `property_listing_engagements_user_saved_idx` (`user_uuid`,`is_saved`),
  CONSTRAINT `property_listing_engagements_listing_fk` FOREIGN KEY (`listing_id`) REFERENCES `property_listings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO authorization_permissions (uuid,name,code,module,domain,action,created_at,updated_at)
SELECT UUID(), x.name, x.code, 'property', x.domain, x.action, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
  SELECT 'Create Listings' name,'listings.create' code,'listings' domain,'create' action UNION ALL SELECT 'Read Listings','listings.read','listings','read' UNION ALL SELECT 'Update Listings','listings.update','listings','update' UNION ALL
  SELECT 'Submit Listings for Review','listings.submit-review','listings','submit-review' UNION ALL SELECT 'Verify Listings','listings.verify','listings','verify' UNION ALL SELECT 'Reject Listings','listings.reject','listings','reject' UNION ALL
  SELECT 'Activate Listings','listings.activate','listings','activate' UNION ALL SELECT 'Publish Listings','listings.publish','listings','publish' UNION ALL SELECT 'Unpublish Listings','listings.unpublish','listings','unpublish' UNION ALL
  SELECT 'Archive Listings','listings.archive','listings','archive' UNION ALL SELECT 'Restore Listings','listings.restore','listings','restore' UNION ALL SELECT 'Mark Listings Sold','listings.sold','listings','sold' UNION ALL
  SELECT 'Mark Listings Rented','listings.rented','listings','rented' UNION ALL SELECT 'Expire Listings','listings.expire','listings','expire' UNION ALL SELECT 'Duplicate Listings','listings.duplicate','listings','duplicate' UNION ALL
  SELECT 'Assign Property Agents','property-agents.assign','property-agents','assign' UNION ALL SELECT 'Change Property Agents','property-agents.change','property-agents','change' UNION ALL SELECT 'Manage Property Owners','property-owners.manage','property-owners','manage'
) x
WHERE NOT EXISTS (SELECT 1 FROM authorization_permissions p WHERE p.code = x.code);

INSERT INTO authorization_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
FROM authorization_roles r CROSS JOIN authorization_permissions p
WHERE r.code='ADMIN' AND p.code IN ('listings.create','listings.read','listings.update','listings.submit-review','listings.verify','listings.reject','listings.activate','listings.publish','listings.unpublish','listings.archive','listings.restore','listings.sold','listings.rented','listings.expire','listings.duplicate','property-agents.assign','property-agents.change','property-owners.manage')
AND NOT EXISTS (SELECT 1 FROM authorization_role_permissions x WHERE x.role_id=r.id AND x.permission_id=p.id);
