CREATE TABLE `sales_pipelines` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_pipelines_uuid_key` (`uuid`),
  KEY `sales_pipelines_status_sortOrder_idx` (`status`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_pipeline_stages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `pipelineUuid` CHAR(36) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `sortOrder` INT NOT NULL,
  `probability` INT NOT NULL DEFAULT 0,
  `isTerminal` BOOLEAN NOT NULL DEFAULT FALSE,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_pipeline_stages_uuid_key` (`uuid`),
  UNIQUE KEY `sales_pipeline_stages_pipelineUuid_code_key` (`pipelineUuid`, `code`),
  UNIQUE KEY `sales_pipeline_stages_pipelineUuid_sortOrder_key` (`pipelineUuid`, `sortOrder`),
  KEY `sales_pipeline_stages_pipelineUuid_isActive_sortOrder_idx` (`pipelineUuid`, `isActive`, `sortOrder`),
  CONSTRAINT `sales_pipeline_stages_pipelineUuid_fkey`
    FOREIGN KEY (`pipelineUuid`) REFERENCES `sales_pipelines` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_opportunities`
  ADD COLUMN `teamUuid` CHAR(36) NULL AFTER `ownerUserUuid`,
  ADD COLUMN `pipelineUuid` CHAR(36) NULL AFTER `teamUuid`,
  ADD COLUMN `stageUuid` CHAR(36) NULL AFTER `pipelineUuid`,
  ADD COLUMN `propertyUuid` CHAR(36) NULL AFTER `stageUuid`,
  ADD COLUMN `title` VARCHAR(180) NOT NULL DEFAULT 'Sales Opportunity' AFTER `propertyUuid`,
  ADD COLUMN `valueAmount` DECIMAL(19,4) NULL AFTER `title`,
  ADD COLUMN `currency` CHAR(3) NULL AFTER `valueAmount`,
  ADD COLUMN `version` INT NOT NULL DEFAULT 1 AFTER `currency`,
  ADD KEY `sales_opportunities_teamUuid_status_idx` (`teamUuid`, `status`),
  ADD KEY `sales_opportunities_pipelineUuid_stageUuid_status_idx` (`pipelineUuid`, `stageUuid`, `status`),
  ADD KEY `sales_opportunities_propertyUuid_status_idx` (`propertyUuid`, `status`),
  ADD KEY `sales_opportunities_createdAt_idx` (`createdAt`),
  ADD CONSTRAINT `sales_opportunities_pipelineUuid_fkey`
    FOREIGN KEY (`pipelineUuid`) REFERENCES `sales_pipelines` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT `sales_opportunities_stageUuid_fkey`
    FOREIGN KEY (`stageUuid`) REFERENCES `sales_pipeline_stages` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE `sales_opportunity_stage_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `opportunityUuid` CHAR(36) NOT NULL,
  `fromStageUuid` CHAR(36) NULL,
  `toStageUuid` CHAR(36) NULL,
  `fromStatus` VARCHAR(30) NULL,
  `toStatus` VARCHAR(30) NOT NULL,
  `actorUserUuid` CHAR(36) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_opportunity_stage_history_uuid_key` (`uuid`),
  KEY `sales_opportunity_stage_history_opportunityUuid_occurredAt_idx` (`opportunityUuid`, `occurredAt`),
  CONSTRAINT `sales_opportunity_stage_history_opportunityUuid_fkey`
    FOREIGN KEY (`opportunityUuid`) REFERENCES `sales_opportunities` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `sales_opportunity_stage_history_fromStageUuid_fkey`
    FOREIGN KEY (`fromStageUuid`) REFERENCES `sales_pipeline_stages` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `sales_opportunity_stage_history_toStageUuid_fkey`
    FOREIGN KEY (`toStageUuid`) REFERENCES `sales_pipeline_stages` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_activities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `opportunityUuid` CHAR(36) NOT NULL,
  `actorUserUuid` CHAR(36) NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `subject` VARCHAR(180) NOT NULL,
  `body` TEXT NULL,
  `dueAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_activities_uuid_key` (`uuid`),
  KEY `sales_activities_opportunityUuid_status_dueAt_idx` (`opportunityUuid`, `status`, `dueAt`),
  KEY `sales_activities_actorUserUuid_dueAt_idx` (`actorUserUuid`, `dueAt`),
  CONSTRAINT `sales_activities_opportunityUuid_fkey`
    FOREIGN KEY (`opportunityUuid`) REFERENCES `sales_opportunities` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_viewings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `opportunityUuid` CHAR(36) NOT NULL,
  `propertyUuid` CHAR(36) NOT NULL,
  `contactUuid` CHAR(36) NOT NULL,
  `scheduledAt` DATETIME(3) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
  `notes` TEXT NULL,
  `actorUserUuid` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_viewings_uuid_key` (`uuid`),
  KEY `sales_viewings_opportunityUuid_scheduledAt_idx` (`opportunityUuid`, `scheduledAt`),
  KEY `sales_viewings_propertyUuid_scheduledAt_status_idx` (`propertyUuid`, `scheduledAt`, `status`),
  CONSTRAINT `sales_viewings_opportunityUuid_fkey`
    FOREIGN KEY (`opportunityUuid`) REFERENCES `sales_opportunities` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_negotiations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `opportunityUuid` CHAR(36) NOT NULL,
  `openedByUuid` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `notes` TEXT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_negotiations_uuid_key` (`uuid`),
  KEY `sales_negotiations_opportunityUuid_status_idx` (`opportunityUuid`, `status`),
  CONSTRAINT `sales_negotiations_opportunityUuid_fkey`
    FOREIGN KEY (`opportunityUuid`) REFERENCES `sales_opportunities` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_negotiation_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `negotiationUuid` CHAR(36) NOT NULL,
  `fromStatus` VARCHAR(20) NULL,
  `toStatus` VARCHAR(20) NOT NULL,
  `actorUserUuid` CHAR(36) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_negotiation_history_uuid_key` (`uuid`),
  KEY `sales_negotiation_history_negotiationUuid_occurredAt_idx` (`negotiationUuid`, `occurredAt`),
  CONSTRAINT `sales_negotiation_history_negotiationUuid_fkey`
    FOREIGN KEY (`negotiationUuid`) REFERENCES `sales_negotiations` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_offers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `negotiationUuid` CHAR(36) NOT NULL,
  `version` INT NOT NULL,
  `amount` DECIMAL(19,4) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `expiresAt` DATETIME(3) NULL,
  `actorUserUuid` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_offers_uuid_key` (`uuid`),
  UNIQUE KEY `sales_offers_negotiationUuid_version_key` (`negotiationUuid`, `version`),
  KEY `sales_offers_negotiationUuid_status_version_idx` (`negotiationUuid`, `status`, `version`),
  CONSTRAINT `sales_offers_negotiationUuid_fkey`
    FOREIGN KEY (`negotiationUuid`) REFERENCES `sales_negotiations` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_deals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `opportunityUuid` CHAR(36) NOT NULL,
  `offerUuid` CHAR(36) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  `ownerUserUuid` CHAR(36) NULL,
  `currency` CHAR(3) NULL,
  `totalAmount` DECIMAL(19,4) NULL,
  `version` INT NOT NULL DEFAULT 1,
  `idempotencyKey` VARCHAR(120) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_deals_uuid_key` (`uuid`),
  UNIQUE KEY `sales_deals_opportunityUuid_key` (`opportunityUuid`),
  UNIQUE KEY `sales_deals_idempotencyKey_key` (`idempotencyKey`),
  KEY `sales_deals_ownerUserUuid_status_createdAt_idx` (`ownerUserUuid`, `status`, `createdAt`),
  KEY `sales_deals_offerUuid_idx` (`offerUuid`),
  CONSTRAINT `sales_deals_opportunityUuid_fkey`
    FOREIGN KEY (`opportunityUuid`) REFERENCES `sales_opportunities` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `sales_deals_offerUuid_fkey`
    FOREIGN KEY (`offerUuid`) REFERENCES `sales_offers` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_deal_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `dealUuid` CHAR(36) NOT NULL,
  `propertyUuid` CHAR(36) NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` INT NOT NULL,
  `unitAmount` DECIMAL(19,4) NOT NULL,
  `lineAmount` DECIMAL(19,4) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_deal_items_uuid_key` (`uuid`),
  KEY `sales_deal_items_dealUuid_idx` (`dealUuid`),
  CONSTRAINT `sales_deal_items_dealUuid_fkey`
    FOREIGN KEY (`dealUuid`) REFERENCES `sales_deals` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_closings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `dealUuid` CHAR(36) NOT NULL,
  `method` VARCHAR(40) NOT NULL,
  `closedAt` DATETIME(3) NOT NULL,
  `actorUserUuid` CHAR(36) NOT NULL,
  `idempotencyKey` VARCHAR(120) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_closings_uuid_key` (`uuid`),
  UNIQUE KEY `sales_closings_dealUuid_key` (`dealUuid`),
  UNIQUE KEY `sales_closings_idempotencyKey_key` (`idempotencyKey`),
  CONSTRAINT `sales_closings_dealUuid_fkey`
    FOREIGN KEY (`dealUuid`) REFERENCES `sales_deals` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_lost_reasons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_lost_reasons_uuid_key` (`uuid`),
  UNIQUE KEY `sales_lost_reasons_code_key` (`code`),
  KEY `sales_lost_reasons_isActive_idx` (`isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_commission_rules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `ratePercent` DECIMAL(7,4) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_commission_rules_uuid_key` (`uuid`),
  UNIQUE KEY `sales_commission_rules_code_key` (`code`),
  KEY `sales_commission_rules_isActive_idx` (`isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_commissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `dealUuid` CHAR(36) NOT NULL,
  `ruleUuid` CHAR(36) NOT NULL,
  `baseAmount` DECIMAL(19,4) NOT NULL,
  `ratePercent` DECIMAL(7,4) NOT NULL,
  `amount` DECIMAL(19,4) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `approvedAt` DATETIME(3) NULL,
  `settledAt` DATETIME(3) NULL,
  `idempotencyKey` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_commissions_uuid_key` (`uuid`),
  UNIQUE KEY `sales_commissions_dealUuid_key` (`dealUuid`),
  UNIQUE KEY `sales_commissions_idempotencyKey_key` (`idempotencyKey`),
  KEY `sales_commissions_status_calculatedAt_idx` (`status`, `calculatedAt`),
  CONSTRAINT `sales_commissions_dealUuid_fkey`
    FOREIGN KEY (`dealUuid`) REFERENCES `sales_deals` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `sales_commissions_ruleUuid_fkey`
    FOREIGN KEY (`ruleUuid`) REFERENCES `sales_commission_rules` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
