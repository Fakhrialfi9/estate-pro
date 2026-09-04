ALTER TABLE `system_webhook_deliveries`
  ADD COLUMN `event_id` VARCHAR(128) NULL AFTER `subscription_id`;

UPDATE `system_webhook_deliveries`
SET `event_id` = `uuid`
WHERE `event_id` IS NULL;

ALTER TABLE `system_webhook_deliveries`
  MODIFY COLUMN `event_id` VARCHAR(128) NOT NULL,
  ADD UNIQUE KEY `system_webhook_delivery_subscription_event_unique` (`subscription_id`, `event_id`);
