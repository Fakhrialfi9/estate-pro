-- Estate Pro property detail aggregates: STEP 123-200
ALTER TABLE `property_facilities`
  ADD COLUMN `available` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `quantity` INT NULL,
  ADD COLUMN `notes` VARCHAR(500) NULL,
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  ADD CONSTRAINT `property_facilities_quantity_nonnegative` CHECK (`quantity` IS NULL OR `quantity` >= 0),
  ADD INDEX `property_facilities_property_available_idx` (`property_id`, `available`);

CREATE TABLE `property_specifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `land_area` DECIMAL(18,2) NULL,
  `land_area_unit` ENUM('SQM') NOT NULL DEFAULT 'SQM',
  `building_area` DECIMAL(18,2) NULL,
  `building_area_unit` ENUM('SQM') NOT NULL DEFAULT 'SQM',
  `floor_area` DECIMAL(18,2) NULL,
  `floor_area_unit` ENUM('SQM') NOT NULL DEFAULT 'SQM',
  `bedrooms` INT NOT NULL DEFAULT 0,
  `bathrooms` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `maid_rooms` INT NOT NULL DEFAULT 0,
  `guest_toilets` INT NOT NULL DEFAULT 0,
  `floors` INT NOT NULL DEFAULT 1,
  `parking_type` ENUM('NONE','CARPORT','GARAGE','OPEN_PARKING','STREET_PARKING','MIXED') NOT NULL DEFAULT 'NONE',
  `parking_spaces` INT NOT NULL DEFAULT 0,
  `living_rooms` INT NOT NULL DEFAULT 0,
  `family_rooms` INT NOT NULL DEFAULT 0,
  `dining_rooms` INT NOT NULL DEFAULT 0,
  `kitchens` INT NOT NULL DEFAULT 0,
  `year_built` INT NULL,
  `year_renovated` INT NULL,
  `orientation` ENUM('NORTH','NORTHEAST','EAST','SOUTHEAST','SOUTH','SOUTHWEST','WEST','NORTHWEST','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  `condition` ENUM('NEW','GOOD','FAIR','NEEDS_RENOVATION','RENOVATED') NOT NULL DEFAULT 'GOOD',
  `furnished_status` ENUM('UNFURNISHED','SEMI_FURNISHED','FULLY_FURNISHED') NOT NULL DEFAULT 'UNFURNISHED',
  `ceiling_height_m` DECIMAL(8,2) NULL,
  `frontage_m` DECIMAL(10,2) NULL,
  `road_width_m` DECIMAL(10,2) NULL,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_specifications_uuid_key` (`uuid`),
  UNIQUE KEY `property_specifications_property_id_key` (`property_id`),
  KEY `property_specifications_year_built_idx` (`year_built`),
  KEY `property_specifications_bedrooms_bathrooms_idx` (`bedrooms`,`bathrooms`),
  CONSTRAINT `property_specifications_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `property_specifications_nonnegative` CHECK (
    (`land_area` IS NULL OR `land_area` >= 0) AND
    (`building_area` IS NULL OR `building_area` >= 0) AND
    (`floor_area` IS NULL OR `floor_area` >= 0) AND
    (`bathrooms` >= 0) AND
    (`bedrooms` >= 0) AND (`maid_rooms` >= 0) AND (`guest_toilets` >= 0) AND
    (`parking_spaces` >= 0) AND (`living_rooms` >= 0) AND (`family_rooms` >= 0) AND
    (`dining_rooms` >= 0) AND (`kitchens` >= 0) AND
    (`ceiling_height_m` IS NULL OR `ceiling_height_m` >= 0) AND
    (`frontage_m` IS NULL OR `frontage_m` >= 0) AND
    (`road_width_m` IS NULL OR `road_width_m` >= 0)
  ),
  CONSTRAINT `property_specifications_floors_positive` CHECK (`floors` > 0),
  CONSTRAINT `property_specifications_years_valid` CHECK (
    (`year_built` IS NULL OR (`year_built` >= 1800 AND `year_built` <= 2100)) AND
    (`year_renovated` IS NULL OR (`year_renovated` >= 1800 AND `year_renovated` <= 2100)) AND
    (`year_renovated` IS NULL OR `year_built` IS NULL OR `year_renovated` >= `year_built`)
  ),
  CONSTRAINT `property_specifications_building_le_land` CHECK (`building_area` IS NULL OR `land_area` IS NULL OR `building_area` <= `land_area`),
  CONSTRAINT `property_specifications_parking_consistent` CHECK (`parking_type` <> 'NONE' OR `parking_spaces` = 0)
) ENGINE=InnoDB;

CREATE TABLE `property_locations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `country_id` BIGINT UNSIGNED NULL,
  `province_id` BIGINT UNSIGNED NULL,
  `city_id` BIGINT UNSIGNED NULL,
  `district_id` BIGINT UNSIGNED NULL,
  `subdistrict_id` BIGINT UNSIGNED NULL,
  `address_line` VARCHAR(500) NULL,
  `street` VARCHAR(200) NULL,
  `building` VARCHAR(160) NULL,
  `block` VARCHAR(80) NULL,
  `unit` VARCHAR(80) NULL,
  `neighborhood` VARCHAR(200) NULL,
  `postal_code` VARCHAR(20) NULL,
  `latitude` DECIMAL(10,7) NULL,
  `longitude` DECIMAL(10,7) NULL,
  `coordinate_accuracy` ENUM('ROOFTOP','RANGE_INTERPOLATED','GEOMETRIC_CENTER','APPROXIMATE','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  `map_provider` ENUM('GOOGLE_MAPS','MAPBOX','OPENSTREETMAP','APPLE_MAPS','OTHER') NULL,
  `place_id` VARCHAR(255) NULL,
  `map_url` VARCHAR(1000) NULL,
  `flood_risk` ENUM('UNKNOWN','LOW','MODERATE','HIGH','VERY_HIGH') NOT NULL DEFAULT 'UNKNOWN',
  `earthquake_risk` ENUM('UNKNOWN','LOW','MODERATE','HIGH','VERY_HIGH') NOT NULL DEFAULT 'UNKNOWN',
  `traffic_risk` ENUM('UNKNOWN','LOW','MODERATE','HIGH','VERY_HIGH') NOT NULL DEFAULT 'UNKNOWN',
  `noise_risk` ENUM('UNKNOWN','LOW','MODERATE','HIGH','VERY_HIGH') NOT NULL DEFAULT 'UNKNOWN',
  `air_quality_risk` ENUM('UNKNOWN','LOW','MODERATE','HIGH','VERY_HIGH') NOT NULL DEFAULT 'UNKNOWN',
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_locations_uuid_key` (`uuid`),
  UNIQUE KEY `property_locations_property_id_key` (`property_id`),
  KEY `property_locations_hierarchy_idx` (`country_id`,`province_id`,`city_id`,`district_id`,`subdistrict_id`),
  KEY `property_locations_coordinates_idx` (`latitude`,`longitude`),
  CONSTRAINT `property_locations_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `property_locations_country_fk` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `property_locations_province_fk` FOREIGN KEY (`province_id`) REFERENCES `provinces` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `property_locations_city_fk` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `property_locations_district_fk` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `property_locations_subdistrict_fk` FOREIGN KEY (`subdistrict_id`) REFERENCES `subdistricts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `property_locations_coordinates_pair` CHECK ((`latitude` IS NULL AND `longitude` IS NULL) OR (`latitude` IS NOT NULL AND `longitude` IS NOT NULL)),
  CONSTRAINT `property_locations_latitude_range` CHECK (`latitude` IS NULL OR (`latitude` >= -90 AND `latitude` <= 90)),
  CONSTRAINT `property_locations_longitude_range` CHECK (`longitude` IS NULL OR (`longitude` >= -180 AND `longitude` <= 180))
) ENGINE=InnoDB;

CREATE TABLE `property_buildings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `foundation` VARCHAR(150) NULL,
  `structure` VARCHAR(150) NULL,
  `walls` VARCHAR(150) NULL,
  `roof` VARCHAR(150) NULL,
  `flooring` VARCHAR(150) NULL,
  `doors` VARCHAR(150) NULL,
  `windows` VARCHAR(150) NULL,
  `facade` VARCHAR(300) NULL,
  `garden` VARCHAR(300) NULL,
  `terrace` VARCHAR(300) NULL,
  `balcony` VARCHAR(300) NULL,
  `rooftop` VARCHAR(300) NULL,
  `has_pool` BOOLEAN NOT NULL DEFAULT FALSE,
  `pool_length_m` DECIMAL(8,2) NULL,
  `pool_width_m` DECIMAL(8,2) NULL,
  `pool_depth_m` DECIMAL(8,2) NULL,
  `interior_style` VARCHAR(150) NULL,
  `interior_design` VARCHAR(500) NULL,
  `natural_lighting` ENUM('EXCELLENT','GOOD','MODERATE','LIMITED','NONE') NOT NULL DEFAULT 'MODERATE',
  `ventilation` ENUM('NATURAL','MECHANICAL','MIXED','NONE') NOT NULL DEFAULT 'NATURAL',
  `smart_home` BOOLEAN NOT NULL DEFAULT FALSE,
  `soundproofing` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_buildings_uuid_key` (`uuid`),
  UNIQUE KEY `property_buildings_property_id_key` (`property_id`),
  CONSTRAINT `property_buildings_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `property_buildings_pool_positive` CHECK (
    (`has_pool` = FALSE AND `pool_length_m` IS NULL AND `pool_width_m` IS NULL AND `pool_depth_m` IS NULL) OR
    (`has_pool` = TRUE AND `pool_length_m` > 0 AND `pool_width_m` > 0 AND `pool_depth_m` > 0)
  )
) ENGINE=InnoDB;

CREATE TABLE `property_rooms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `room_type` ENUM('MASTER_BEDROOM','BEDROOM','LIVING_ROOM','FAMILY_ROOM','DINING_ROOM','KITCHEN','BATHROOM','GUEST_TOILET','MAID_ROOM','STUDY','OFFICE','PLAYROOM','STORAGE','LAUNDRY','PRAYER_ROOM','OTHER') NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `floor` INT NOT NULL,
  `area` DECIMAL(18,2) NOT NULL,
  `area_unit` ENUM('SQM') NOT NULL DEFAULT 'SQM',
  `has_bathroom` BOOLEAN NOT NULL DEFAULT FALSE,
  `has_walk_in_closet` BOOLEAN NOT NULL DEFAULT FALSE,
  `has_balcony` BOOLEAN NOT NULL DEFAULT FALSE,
  `has_air_conditioning` BOOLEAN NOT NULL DEFAULT FALSE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_rooms_uuid_key` (`uuid`),
  KEY `property_rooms_property_deleted_order_idx` (`property_id`,`deleted_at`,`sort_order`),
  KEY `property_rooms_property_type_deleted_idx` (`property_id`,`room_type`,`deleted_at`),
  CONSTRAINT `property_rooms_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `property_rooms_area_positive` CHECK (`area` > 0),
  CONSTRAINT `property_rooms_sort_nonnegative` CHECK (`sort_order` >= 0)
) ENGINE=InnoDB;
