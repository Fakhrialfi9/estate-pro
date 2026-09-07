ALTER TABLE `system_webhook_deliveries`
  ADD COLUMN `payload` JSON NULL AFTER `payload_hash`;

UPDATE `system_webhook_deliveries`
SET
  `state` = 'DEAD_LETTER',
  `completed_at` = COALESCE(`completed_at`, CURRENT_TIMESTAMP(3)),
  `next_attempt_at` = NULL,
  `failure_reason` = COALESCE(`failure_reason`, 'Legacy delivery did not persist a retryable payload')
WHERE `state` IN ('PENDING', 'RETRYING') AND `payload` IS NULL;

UPDATE `system_webhook_deliveries`
SET `payload` = JSON_OBJECT()
WHERE `payload` IS NULL;

ALTER TABLE `system_webhook_deliveries`
  MODIFY COLUMN `payload` JSON NOT NULL;
