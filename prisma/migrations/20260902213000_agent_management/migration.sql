CREATE TABLE `agent_profiles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `user_uuid` CHAR(36) NOT NULL,
  `display_name` VARCHAR(220) NULL,
  `bio` TEXT NULL,
  `status` ENUM('ACTIVE','INACTIVE','SUSPENDED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `hire_date` DATE NULL,
  `license_number_masked` VARCHAR(80) NULL,
  `time_zone` VARCHAR(80) NOT NULL DEFAULT 'UTC',
  `max_active_assignments` INT UNSIGNED NOT NULL DEFAULT 10,
  `version` INT NOT NULL DEFAULT 1,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_profiles_uuid_key` (`uuid`),
  UNIQUE KEY `agent_profiles_user_uuid_key` (`user_uuid`),
  KEY `agent_profiles_status_deleted_updated_idx` (`status`,`deleted_at`,`updated_at`),
  KEY `agent_profiles_timezone_idx` (`time_zone`)
) ENGINE=InnoDB;

CREATE TABLE `agent_specializations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` VARCHAR(500) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_specializations_uuid_key` (`uuid`),
  UNIQUE KEY `agent_specializations_code_key` (`code`),
  KEY `agent_specializations_active_order_idx` (`is_active`,`sort_order`)
) ENGINE=InnoDB;

CREATE TABLE `agent_specialization_links` (
  `agent_id` BIGINT UNSIGNED NOT NULL,
  `specialization_id` BIGINT UNSIGNED NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`agent_id`,`specialization_id`),
  KEY `agent_specialization_links_specialization_primary_idx` (`specialization_id`,`is_primary`),
  KEY `agent_specialization_links_agent_primary_idx` (`agent_id`,`is_primary`),
  CONSTRAINT `agent_specialization_links_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `agent_specialization_links_specialization_fk` FOREIGN KEY (`specialization_id`) REFERENCES `agent_specializations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `agent_coverages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `agent_id` BIGINT UNSIGNED NOT NULL,
  `level` ENUM('COUNTRY','PROVINCE','CITY','DISTRICT','SUBDISTRICT') NOT NULL,
  `region_uuid` CHAR(36) NOT NULL,
  `label` VARCHAR(180) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_coverages_uuid_key` (`uuid`),
  UNIQUE KEY `agent_coverages_agent_level_region_key` (`agent_id`,`level`,`region_uuid`),
  KEY `agent_coverages_level_region_active_idx` (`level`,`region_uuid`,`is_active`),
  KEY `agent_coverages_agent_active_idx` (`agent_id`,`is_active`),
  CONSTRAINT `agent_coverages_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `agent_availability` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `agent_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('ACTIVE','UNAVAILABLE','LEAVE','OFFLINE') NOT NULL DEFAULT 'ACTIVE',
  `time_zone` VARCHAR(80) NOT NULL DEFAULT 'UTC',
  `effective_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_availability_uuid_key` (`uuid`),
  UNIQUE KEY `agent_availability_agent_key` (`agent_id`),
  KEY `agent_availability_status_effective_idx` (`status`,`effective_at`),
  CONSTRAINT `agent_availability_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `agent_weekly_schedules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `agent_id` BIGINT UNSIGNED NOT NULL,
  `weekday` TINYINT UNSIGNED NOT NULL,
  `start_time` CHAR(5) NOT NULL,
  `end_time` CHAR(5) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_weekly_schedule_uuid_key` (`uuid`),
  UNIQUE KEY `agent_weekly_schedule_key` (`agent_id`,`weekday`,`start_time`,`end_time`),
  KEY `agent_weekly_schedule_agent_day_active_idx` (`agent_id`,`weekday`,`is_active`),
  CONSTRAINT `agent_weekly_schedules_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `agent_availability_exceptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `agent_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('ACTIVE','UNAVAILABLE','LEAVE','OFFLINE') NOT NULL,
  `starts_at` DATETIME(3) NOT NULL,
  `ends_at` DATETIME(3) NOT NULL,
  `reason` VARCHAR(255) NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_availability_exceptions_uuid_key` (`uuid`),
  KEY `agent_availability_exceptions_agent_range_idx` (`agent_id`,`starts_at`,`ends_at`),
  CONSTRAINT `agent_availability_exceptions_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `agent_targets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `agent_id` BIGINT UNSIGNED NOT NULL,
  `metric_type` VARCHAR(80) NOT NULL,
  `period_type` ENUM('MONTH','QUARTER','YEAR','CUSTOM') NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `target_value` DECIMAL(24,4) NOT NULL,
  `scope` VARCHAR(120) NULL,
  `status` ENUM('ACTIVE','CLOSED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `created_by` CHAR(36) NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_targets_uuid_key` (`uuid`),
  UNIQUE KEY `agent_targets_agent_metric_period_key` (`agent_id`,`metric_type`,`period_start`,`period_end`),
  KEY `agent_targets_agent_status_period_idx` (`agent_id`,`status`,`period_start`,`period_end`),
  KEY `agent_targets_metric_status_period_idx` (`metric_type`,`status`,`period_start`,`period_end`),
  CONSTRAINT `agent_targets_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `property_agent_assignments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `agent_user_uuid` CHAR(36) NOT NULL,
  `assigned_by_uuid` CHAR(36) NOT NULL,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `unassigned_at` DATETIME(3) NULL,
  `unassigned_by_uuid` CHAR(36) NULL,
  `reason` VARCHAR(255) NULL,
  `version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_agent_assignments_uuid_key` (`uuid`),
  UNIQUE KEY `property_agent_assignments_property_agent_key` (`property_id`,`agent_user_uuid`),
  KEY `property_agent_assignments_agent_active_idx` (`agent_user_uuid`,`unassigned_at`,`updated_at`),
  KEY `property_agent_assignments_property_active_idx` (`property_id`,`unassigned_at`,`updated_at`),
  CONSTRAINT `property_agent_assignments_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `property_agent_assignment_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `property_uuid` CHAR(36) NOT NULL,
  `agent_user_uuid` CHAR(36) NOT NULL,
  `actor_user_uuid` CHAR(36) NOT NULL,
  `action` VARCHAR(20) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reason` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `property_agent_assignment_history_uuid_key` (`uuid`),
  KEY `property_agent_assignment_history_agent_idx` (`agent_user_uuid`,`occurred_at`,`id`),
  KEY `property_agent_assignment_history_property_idx` (`property_uuid`,`occurred_at`,`id`),
  CONSTRAINT `property_agent_assignment_history_property_fk` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO authorization_permissions (`uuid`,`name`,`code`,`module`,`domain`,`action`,`created_at`,`updated_at`) VALUES
(UUID(),'Access Agent Management','agents.access','agent-management','agents','access',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Agents','agents.read','agent-management','agents','read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Manage Agents','agents.manage','agent-management','agents','manage',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Manage Agent Specializations','agents.specialization.manage','agent-management','agents','specialization.manage',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Manage Agent Locations','agents.location.manage','agent-management','agents','location.manage',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Manage Agent Availability','agents.availability.manage','agent-management','agents','availability.manage',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Self Assign Property','agents.assignment.self','agent-management','agents','assignment.self',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Manage Agent Assignments','agents.assignment.manage','agent-management','agents','assignment.manage',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Agent Targets','agents.target.read','agent-management','agents','target.read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Manage Agent Targets','agents.target.manage','agent-management','agents','target.manage',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)),
(UUID(),'Read Agent Performance','agents.performance.read','agent-management','agents','performance.read',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));

INSERT INTO authorization_role_permissions (`role_id`,`permission_id`,`created_at`,`updated_at`)
SELECT r.id,p.id,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
FROM authorization_roles r CROSS JOIN authorization_permissions p
WHERE r.code='ADMIN'
  AND p.code IN ('agents.access','agents.read','agents.manage','agents.specialization.manage','agents.location.manage','agents.availability.manage','agents.assignment.self','agents.assignment.manage','agents.target.read','agents.target.manage','agents.performance.read')
  AND NOT EXISTS (SELECT 1 FROM authorization_role_permissions x WHERE x.role_id=r.id AND x.permission_id=p.id);

INSERT INTO authorization_roles (`uuid`,`name`,`code`,`description`,`is_active`,`created_at`,`updated_at`)
VALUES (UUID(),'Agent','AGENT','Estate sales/property agent',TRUE,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `description`=VALUES(`description`), `is_active`=TRUE, `updated_at`=CURRENT_TIMESTAMP(3);

INSERT INTO authorization_role_permissions (`role_id`,`permission_id`,`created_at`,`updated_at`)
SELECT r.id,p.id,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
FROM authorization_roles r JOIN authorization_permissions p ON p.code IN ('agents.access','agents.read','agents.assignment.self','agents.target.read','agents.performance.read')
WHERE r.code='AGENT'
  AND NOT EXISTS (SELECT 1 FROM authorization_role_permissions x WHERE x.role_id=r.id AND x.permission_id=p.id);
