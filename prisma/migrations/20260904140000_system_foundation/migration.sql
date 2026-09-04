CREATE TABLE `system_settings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `key` VARCHAR(128) NOT NULL,
  `scope` VARCHAR(32) NOT NULL,
  `scopeKey` VARCHAR(128) NOT NULL DEFAULT 'global',
  `valueType` VARCHAR(16) NOT NULL,
  `value` VARCHAR(4000) NOT NULL,
  `mutable` BOOLEAN NOT NULL DEFAULT true,
  `version` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_settings_uuid_key` (`uuid`),
  UNIQUE KEY `system_settings_key_scope_scopeKey_key` (`key`,`scope`,`scopeKey`),
  KEY `system_settings_scope_scopeKey_idx` (`scope`,`scopeKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `system_activities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `actorUuid` CHAR(36) NULL,
  `eventType` VARCHAR(80) NOT NULL,
  `category` VARCHAR(40) NOT NULL,
  `resourceType` VARCHAR(80) NULL,
  `resourceUuid` CHAR(36) NULL,
  `summary` VARCHAR(500) NOT NULL,
  `metadata` JSON NOT NULL,
  `requestId` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_activities_uuid_key` (`uuid`),
  KEY `system_activities_actorUuid_createdAt_idx` (`actorUuid`,`createdAt`),
  KEY `system_activities_resourceType_resourceUuid_createdAt_idx` (`resourceType`,`resourceUuid`,`createdAt`),
  KEY `system_activities_category_createdAt_idx` (`category`,`createdAt`),
  KEY `system_activities_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
