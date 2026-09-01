ALTER TABLE `sales_opportunities`
  ADD COLUMN `lostReasonUuid` CHAR(36) NULL,
  ADD INDEX `sales_opportunities_lostReasonUuid_idx` (`lostReasonUuid`);

ALTER TABLE `sales_deals`
  ADD COLUMN `lostReasonUuid` CHAR(36) NULL,
  ADD INDEX `sales_deals_lostReasonUuid_idx` (`lostReasonUuid`);
