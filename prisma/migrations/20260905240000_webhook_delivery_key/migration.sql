ALTER TABLE `system_webhook_deliveries`
  ADD COLUMN `delivery_key` VARCHAR(180) NULL AFTER `event_id`;

UPDATE `system_webhook_deliveries`
SET `delivery_key` = `event_id`
WHERE `delivery_key` IS NULL;

ALTER TABLE `system_webhook_deliveries`
  MODIFY COLUMN `delivery_key` VARCHAR(180) NOT NULL,
  DROP INDEX `system_webhook_delivery_subscription_event_unique`,
  ADD UNIQUE KEY `system_webhook_delivery_subscription_delivery_key_unique`
    (`subscription_id`, `delivery_key`);
