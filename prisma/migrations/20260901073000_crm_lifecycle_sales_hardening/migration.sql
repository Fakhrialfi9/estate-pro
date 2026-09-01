ALTER TABLE `crm_leads`
  ADD COLUMN `qualificationReason` VARCHAR(255) NULL,
  ADD COLUMN `closureOutcome` VARCHAR(30) NULL,
  ADD COLUMN `convertedAt` DATETIME(3) NULL,
  ADD COLUMN `conversionKey` VARCHAR(120) NULL,
  ADD UNIQUE KEY `crm_leads_conversionKey_key` (`conversionKey`);

ALTER TABLE `crm_inquiries`
  ADD COLUMN `idempotencyKey` VARCHAR(120) NULL,
  ADD UNIQUE KEY `crm_inquiries_idempotencyKey_key` (`idempotencyKey`);

ALTER TABLE `crm_communications`
  ADD COLUMN `idempotencyKey` VARCHAR(120) NULL,
  ADD UNIQUE KEY `crm_communications_idempotencyKey_key` (`idempotencyKey`);

CREATE TABLE `sales_opportunities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `leadUuid` CHAR(36) NOT NULL,
  `contactUuid` CHAR(36) NOT NULL,
  `ownerUserUuid` CHAR(36) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  `idempotencyKey` VARCHAR(120) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_opportunities_uuid_key` (`uuid`),
  UNIQUE KEY `sales_opportunities_leadUuid_key` (`leadUuid`),
  UNIQUE KEY `sales_opportunities_idempotencyKey_key` (`idempotencyKey`),
  KEY `sales_opportunities_contactUuid_idx` (`contactUuid`),
  KEY `sales_opportunities_ownerUserUuid_status_idx` (`ownerUserUuid`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
