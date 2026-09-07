ALTER TABLE `automation_workflow_executions`
  ADD COLUMN `priority` INT NOT NULL DEFAULT 50 AFTER `state`;

CREATE INDEX `automation_workflow_executions_state_retryAt_priority_createdAt_idx`
  ON `automation_workflow_executions` (`state`, `retry_at`, `priority`, `created_at`);
