ALTER TABLE `system_webhook_subscriptions`
  ADD COLUMN `filters` JSON NULL AFTER `events`;

UPDATE `system_webhook_subscriptions`
SET `filters` = JSON_ARRAY()
WHERE `filters` IS NULL;

ALTER TABLE `system_webhook_subscriptions`
  MODIFY COLUMN `filters` JSON NOT NULL;
