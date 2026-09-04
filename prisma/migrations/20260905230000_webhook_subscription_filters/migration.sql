ALTER TABLE `system_webhook_subscriptions`
  ADD COLUMN `filters` JSON NOT NULL AFTER `events`;
