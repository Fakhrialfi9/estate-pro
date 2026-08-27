CREATE TABLE `property_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_type_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `icon` VARCHAR(100) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE KEY `property_categories_uuid_key` (`uuid`),
  UNIQUE KEY `property_categories_type_code_key` (`property_type_id`,`code`),
  UNIQUE KEY `property_categories_type_slug_key` (`property_type_id`,`slug`),
  KEY `property_categories_type_idx` (`property_type_id`),
  KEY `property_categories_active_idx` (`is_active`),
  KEY `property_categories_sort_idx` (`sort_order`),
  KEY `property_categories_active_deleted_sort_idx` (`is_active`,`deleted_at`,`sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `property_categories_type_fk` FOREIGN KEY (`property_type_id`) REFERENCES `property_types` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `property_subcategories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_category_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE KEY `property_subcategories_uuid_key` (`uuid`),
  UNIQUE KEY `property_subcategories_category_code_key` (`property_category_id`,`code`),
  UNIQUE KEY `property_subcategories_category_slug_key` (`property_category_id`,`slug`),
  KEY `property_subcategories_category_idx` (`property_category_id`),
  KEY `property_subcategories_active_idx` (`is_active`),
  KEY `property_subcategories_sort_idx` (`sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `property_subcategories_category_fk` FOREIGN KEY (`property_category_id`) REFERENCES `property_categories` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `countries` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `uuid` CHAR(36) NOT NULL, `code` VARCHAR(20) NOT NULL, `name` VARCHAR(150) NOT NULL, `slug` VARCHAR(160) NOT NULL, `is_active` BOOLEAN NOT NULL DEFAULT true, `sort_order` INTEGER NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL, `deleted_at` DATETIME(3) NULL, UNIQUE KEY `countries_uuid_key` (`uuid`), UNIQUE KEY `countries_code_key` (`code`), UNIQUE KEY `countries_slug_key` (`slug`), KEY `countries_active_deleted_sort_idx` (`is_active`,`deleted_at`,`sort_order`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `provinces` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `uuid` CHAR(36) NOT NULL, `country_id` BIGINT UNSIGNED NOT NULL, `code` VARCHAR(30) NOT NULL, `name` VARCHAR(150) NOT NULL, `slug` VARCHAR(160) NOT NULL, `is_active` BOOLEAN NOT NULL DEFAULT true, `sort_order` INTEGER NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL, `deleted_at` DATETIME(3) NULL, UNIQUE KEY `provinces_uuid_key` (`uuid`), UNIQUE KEY `provinces_country_code_key` (`country_id`,`code`), UNIQUE KEY `provinces_country_slug_key` (`country_id`,`slug`), KEY `provinces_country_idx` (`country_id`), KEY `provinces_active_deleted_sort_idx` (`is_active`,`deleted_at`,`sort_order`), PRIMARY KEY (`id`), CONSTRAINT `provinces_country_fk` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `cities` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `uuid` CHAR(36) NOT NULL, `province_id` BIGINT UNSIGNED NOT NULL, `code` VARCHAR(30) NOT NULL, `name` VARCHAR(150) NOT NULL, `slug` VARCHAR(160) NOT NULL, `is_active` BOOLEAN NOT NULL DEFAULT true, `sort_order` INTEGER NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL, `deleted_at` DATETIME(3) NULL, UNIQUE KEY `cities_uuid_key` (`uuid`), UNIQUE KEY `cities_province_code_key` (`province_id`,`code`), UNIQUE KEY `cities_province_slug_key` (`province_id`,`slug`), KEY `cities_province_idx` (`province_id`), KEY `cities_active_deleted_sort_idx` (`is_active`,`deleted_at`,`sort_order`), PRIMARY KEY (`id`), CONSTRAINT `cities_province_fk` FOREIGN KEY (`province_id`) REFERENCES `provinces` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `districts` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `uuid` CHAR(36) NOT NULL, `city_id` BIGINT UNSIGNED NOT NULL, `code` VARCHAR(30) NOT NULL, `name` VARCHAR(150) NOT NULL, `slug` VARCHAR(160) NOT NULL, `is_active` BOOLEAN NOT NULL DEFAULT true, `sort_order` INTEGER NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL, `deleted_at` DATETIME(3) NULL, UNIQUE KEY `districts_uuid_key` (`uuid`), UNIQUE KEY `districts_city_code_key` (`city_id`,`code`), UNIQUE KEY `districts_city_slug_key` (`city_id`,`slug`), KEY `districts_city_idx` (`city_id`), KEY `districts_active_deleted_sort_idx` (`is_active`,`deleted_at`,`sort_order`), PRIMARY KEY (`id`), CONSTRAINT `districts_city_fk` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `subdistricts` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `uuid` CHAR(36) NOT NULL, `district_id` BIGINT UNSIGNED NOT NULL, `code` VARCHAR(30) NOT NULL, `name` VARCHAR(150) NOT NULL, `slug` VARCHAR(160) NOT NULL, `is_active` BOOLEAN NOT NULL DEFAULT true, `sort_order` INTEGER NOT NULL DEFAULT 0, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL, `deleted_at` DATETIME(3) NULL, UNIQUE KEY `subdistricts_uuid_key` (`uuid`), UNIQUE KEY `subdistricts_district_code_key` (`district_id`,`code`), UNIQUE KEY `subdistricts_district_slug_key` (`district_id`,`slug`), KEY `subdistricts_district_idx` (`district_id`), KEY `subdistricts_active_deleted_sort_idx` (`is_active`,`deleted_at`,`sort_order`), PRIMARY KEY (`id`), CONSTRAINT `subdistricts_district_fk` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
