-- Property capabilities: reusable amenities, versioned private documents, and immutable business history.
CREATE TABLE `property_amenities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `category` ENUM('LIVING','KITCHEN','BATHROOM','OUTDOOR','SECURITY','PARKING','TECHNOLOGY','ACCESSIBILITY','RECREATION','UTILITY','OTHER') NOT NULL DEFAULT 'OTHER',
  `description` VARCHAR(500) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_amenities_uuid_key` (`uuid`),
  UNIQUE KEY `property_amenities_code_key` (`code`),
  KEY `property_amenities_catalog_idx` (`category`,`is_active`,`sort_order`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_amenity_assignments` (
  `property_id` BIGINT UNSIGNED NOT NULL,
  `amenity_id` BIGINT UNSIGNED NOT NULL,
  `available` BOOLEAN NOT NULL DEFAULT TRUE,
  `value` VARCHAR(120) NULL,
  `notes` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`property_id`,`amenity_id`),
  KEY `property_amenity_assignments_amenity_idx` (`amenity_id`),
  KEY `property_amenity_assignments_property_available_idx` (`property_id`,`available`),
  CONSTRAINT `property_amenity_assignments_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `property_amenity_assignments_amenity_fk` FOREIGN KEY (`amenity_id`) REFERENCES `property_amenities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `classification` ENUM('CERTIFICATE','LEGAL','FINANCIAL','SUPPORTING','OTHER') NOT NULL DEFAULT 'OTHER',
  `title` VARCHAR(200) NOT NULL,
  `visibility` ENUM('PRIVATE','RESTRICTED') NOT NULL DEFAULT 'RESTRICTED',
  `status` ENUM('REGISTERED','ACTIVE','ARCHIVED','DELETED') NOT NULL DEFAULT 'REGISTERED',
  `current_version` INT NOT NULL DEFAULT 1,
  `retention_until` DATETIME(3) NULL,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_documents_uuid_key` (`uuid`),
  KEY `property_documents_property_status_idx` (`property_id`,`status`,`updated_at`,`id`),
  KEY `property_documents_access_idx` (`property_id`,`classification`,`visibility`,`status`),
  CONSTRAINT `property_documents_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_document_versions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `document_id` BIGINT UNSIGNED NOT NULL,
  `version` INT NOT NULL,
  `storage_provider` VARCHAR(80) NULL,
  `storage_key` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(120) NOT NULL,
  `extension` VARCHAR(20) NULL,
  `file_size_bytes` INT UNSIGNED NULL,
  `checksum_sha256` CHAR(64) NOT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_document_versions_uuid_key` (`uuid`),
  UNIQUE KEY `property_document_versions_document_version_key` (`document_id`,`version`),
  KEY `property_document_versions_document_idx` (`document_id`,`created_at`,`id`),
  CONSTRAINT `property_document_versions_document_fk` FOREIGN KEY (`document_id`) REFERENCES `property_documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `event` ENUM('CREATED','UPDATED','PRICE_CHANGED','STATUS_CHANGED','LISTING_CHANGED','SEO_CHANGED','MEDIA_CHANGED','AGENT_CHANGED') NOT NULL,
  `actor_uuid` CHAR(36) NULL,
  `summary` VARCHAR(255) NOT NULL,
  `changes` JSON NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_history_uuid_key` (`uuid`),
  KEY `property_history_property_occurred_idx` (`property_id`,`occurred_at`,`id`),
  KEY `property_history_property_event_idx` (`property_id`,`event`,`occurred_at`,`id`),
  KEY `property_history_actor_occurred_idx` (`actor_uuid`,`occurred_at`,`id`),
  CONSTRAINT `property_history_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
