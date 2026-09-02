SET @estatepro_sales_opportunities_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'sales_opportunities'
    AND column_name = 'lostReasonUuid'
);
SET @estatepro_sales_opportunities_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sales_opportunities'
    AND index_name = 'sales_opportunities_lostReasonUuid_idx'
);
SET @estatepro_sales_opportunities_sql := CASE
  WHEN @estatepro_sales_opportunities_column_exists = 0
   AND @estatepro_sales_opportunities_index_exists = 0
    THEN 'ALTER TABLE `sales_opportunities` ADD COLUMN `lostReasonUuid` CHAR(36) NULL, ADD INDEX `sales_opportunities_lostReasonUuid_idx` (`lostReasonUuid`)'
  WHEN @estatepro_sales_opportunities_column_exists = 0
    THEN 'ALTER TABLE `sales_opportunities` ADD COLUMN `lostReasonUuid` CHAR(36) NULL'
  WHEN @estatepro_sales_opportunities_index_exists = 0
    THEN 'ALTER TABLE `sales_opportunities` ADD INDEX `sales_opportunities_lostReasonUuid_idx` (`lostReasonUuid`)'
  ELSE 'SELECT 1'
END;
PREPARE estatepro_sales_opportunities_stmt FROM @estatepro_sales_opportunities_sql;
EXECUTE estatepro_sales_opportunities_stmt;
DEALLOCATE PREPARE estatepro_sales_opportunities_stmt;

SET @estatepro_sales_deals_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'sales_deals'
);
SET @estatepro_sales_deals_sql := CASE
  WHEN @estatepro_sales_deals_exists = 0
    THEN 'SELECT 1'
  WHEN (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'sales_deals'
      AND column_name = 'lostReasonUuid'
  ) = 0
   AND (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'sales_deals'
      AND index_name = 'sales_deals_lostReasonUuid_idx'
  ) = 0
    THEN 'ALTER TABLE `sales_deals` ADD COLUMN `lostReasonUuid` CHAR(36) NULL, ADD INDEX `sales_deals_lostReasonUuid_idx` (`lostReasonUuid`)'
  WHEN (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'sales_deals'
      AND column_name = 'lostReasonUuid'
  ) = 0
    THEN 'ALTER TABLE `sales_deals` ADD COLUMN `lostReasonUuid` CHAR(36) NULL'
  WHEN (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'sales_deals'
      AND index_name = 'sales_deals_lostReasonUuid_idx'
  ) = 0
    THEN 'ALTER TABLE `sales_deals` ADD INDEX `sales_deals_lostReasonUuid_idx` (`lostReasonUuid`)'
  ELSE 'SELECT 1'
END;
PREPARE estatepro_sales_deals_stmt FROM @estatepro_sales_deals_sql;
EXECUTE estatepro_sales_deals_stmt;
DEALLOCATE PREPARE estatepro_sales_deals_stmt;
