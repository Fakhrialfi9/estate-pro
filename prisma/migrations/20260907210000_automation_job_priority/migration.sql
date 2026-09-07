ALTER TABLE `automation_workflow_executions`
  ADD COLUMN `priority` INT NOT NULL DEFAULT 50 AFTER `state`;

CREATE INDEX `automation_exec_state_retry_priority_created_idx`
  ON `automation_workflow_executions` (`state`, `retry_at`, `priority`, `created_at`);
