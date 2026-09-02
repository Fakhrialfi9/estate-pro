DELIMITER $$

CREATE PROCEDURE `__estatepro_add_sales_lost_reason_columns`()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'sales_opportunities'
      AND column_name = 'lostReasonUuid'
  ) THEN
    ALTER TABLE `sales_opportunities`
      ADD COLUMN `lostReasonUuid` CHAR(36) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'sales_opportunities'
      AND index_name = 'sales_opportunities_lostReasonUuid_idx'
  ) THEN
    ALTER TABLE `sales_opportunities`
      ADD INDEX `sales_opportunities_lostReasonUuid_idx` (`lostReasonUuid`);
  END IF;

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

CALL `__estatepro_add_sales_lost_reason_columns`()$$
DROP PROCEDURE `__estatepro_add_sales_lost_reason_columns`$$

DELIMITER ;
