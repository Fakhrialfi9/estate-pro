ALTER TABLE `sales_opportunities`
  ADD COLUMN IF NOT EXISTS `lostReasonUuid` CHAR(36) NULL,
  ADD INDEX IF NOT EXISTS `sales_opportunities_lostReasonUuid_idx` (`lostReasonUuid`);

SET @estatepro_sales_deals_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'sales_deals'
);
SET @estatepro_sales_deals_sql := IF(
  @estatepro_sales_deals_exists = 1,
  'ALTER TABLE `sales_deals` ADD COLUMN IF NOT EXISTS `lostReasonUuid` CHAR(36) NULL, ADD INDEX IF NOT EXISTS `sales_deals_lostReasonUuid_idx` (`lostReasonUuid`)',
  'SELECT 1'
);
PREPARE estatepro_sales_deals_stmt FROM @estatepro_sales_deals_sql;
EXECUTE estatepro_sales_deals_stmt;
DEALLOCATE PREPARE estatepro_sales_deals_stmt;
