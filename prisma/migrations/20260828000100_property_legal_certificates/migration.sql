CREATE TABLE `property_legal` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `uuid` CHAR(36) NOT NULL, `property_id` BIGINT UNSIGNED NOT NULL,
  `ownership_type` ENUM('INDIVIDUAL','COMPANY','JOINT','GOVERNMENT','FOUNDATION','COOPERATIVE','OTHER') NOT NULL DEFAULT 'OTHER',
  `ownership_status` ENUM('UNKNOWN','PENDING','VERIFIED','DISPUTED','REJECTED') NOT NULL DEFAULT 'UNKNOWN',
  `owner_reference_hash` CHAR(64) NULL, `owner_reference_masked` VARCHAR(128) NULL,
  `verification_status` ENUM('UNVERIFIED','PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
  `verified_at` DATETIME(3) NULL, `verified_by` CHAR(36) NULL, `verification_source` VARCHAR(120) NULL,
  `zoning_zone` VARCHAR(120) NULL, `allowed_use` VARCHAR(500) NULL, `building_coverage_ratio` DECIMAL(8,4) NULL, `floor_area_ratio` DECIMAL(8,4) NULL,
  `disputes` JSON NULL, `encumbrances` JSON NULL, `created_by` CHAR(36) NULL, `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `property_legal_uuid_key` (`uuid`), UNIQUE KEY `property_legal_property_id_key` (`property_id`), KEY `property_legal_status_idx` (`verification_status`,`ownership_status`),
  CONSTRAINT `property_legal_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `property_legal_ratio_check` CHECK ((`building_coverage_ratio` IS NULL OR (`building_coverage_ratio` >= 0 AND `building_coverage_ratio` <= 100)) AND (`floor_area_ratio` IS NULL OR `floor_area_ratio` >= 0))
) ENGINE=InnoDB;
CREATE TABLE `property_certificates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `uuid` CHAR(36) NOT NULL, `property_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('SHM','HGB','HGU','PBG','IMB','SLF','GIRIK','AJB','PPJB','OTHER') NOT NULL,
  `number_hash` CHAR(64) NOT NULL, `number_masked` VARCHAR(100) NOT NULL,
  `status` ENUM('UNKNOWN','PENDING','VALID','EXPIRED','REVOKED') NOT NULL DEFAULT 'UNKNOWN',
  `issue_date` DATE NULL, `expiry_date` DATE NULL, `issuer` VARCHAR(200) NULL, `created_by` CHAR(36) NULL, `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `property_certificates_uuid_key` (`uuid`), UNIQUE KEY `property_certificates_property_number_key` (`property_id`,`number_hash`),
  KEY `property_certificates_property_type_deleted_idx` (`property_id`,`type`,`deleted_at`), KEY `property_certificates_status_expiry_idx` (`status`,`expiry_date`),
  CONSTRAINT `property_certificates_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `property_certificates_dates_check` CHECK (`issue_date` IS NULL OR `expiry_date` IS NULL OR `issue_date` <= `expiry_date`)
) ENGINE=InnoDB;
