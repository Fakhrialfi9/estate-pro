DELIMITER $$

CREATE PROCEDURE `__estatepro_reconcile_sales_lost_reason`()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'sales_deals'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'sales_deals'
        AND column_name = 'lostReasonUuid'
    ) THEN
      ALTER TABLE `sales_deals`
        ADD COLUMN `lostReasonUuid` CHAR(36) NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'sales_deals'
        AND index_name = 'sales_deals_lostReasonUuid_idx'
    ) THEN
      ALTER TABLE `sales_deals`
        ADD INDEX `sales_deals_lostReasonUuid_idx` (`lostReasonUuid`);
    END IF;
  END IF;
END$$

CALL `__estatepro_reconcile_sales_lost_reason`()$$
DROP PROCEDURE `__estatepro_reconcile_sales_lost_reason`$$

DELIMITER ;
