CREATE TABLE `automation_workflows` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `ownerUserUuid` CHAR(36) NOT NULL,
  `activeVersionUuid` CHAR(36) NULL,
  `createdBy` CHAR(36) NOT NULL,
  `updatedBy` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_workflows_uuid_key` (`uuid`),
  KEY `automation_workflows_status_ownerUserUuid_idx` (`status`, `ownerUserUuid`),
  KEY `automation_workflows_activeVersionUuid_idx` (`activeVersionUuid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_workflow_versions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `workflowUuid` CHAR(36) NOT NULL,
  `version` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `triggerDefinition` JSON NOT NULL,
  `definition` JSON NOT NULL,
  `checksum` CHAR(64) NOT NULL,
  `createdBy` CHAR(36) NOT NULL,
  `activatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_workflow_versions_uuid_key` (`uuid`),
  UNIQUE KEY `automation_workflow_versions_workflowUuid_version_key` (`workflowUuid`, `version`),
  UNIQUE KEY `automation_workflow_versions_workflowUuid_checksum_key` (`workflowUuid`, `checksum`),
  KEY `automation_workflow_versions_workflowUuid_status_idx` (`workflowUuid`, `status`),
  CONSTRAINT `automation_workflow_versions_workflowUuid_fkey`
    FOREIGN KEY (`workflowUuid`) REFERENCES `automation_workflows` (`uuid`) ON UPDATE CASCADE ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_workflow_executions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `workflowUuid` CHAR(36) NOT NULL,
  `workflowVersionUuid` CHAR(36) NOT NULL,
  `eventId` CHAR(36) NOT NULL,
  `eventType` VARCHAR(80) NOT NULL,
  `entityType` VARCHAR(60) NOT NULL,
  `entityUuid` CHAR(36) NOT NULL,
  `state` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `currentNodeId` VARCHAR(120) NULL,
  `contextSnapshot` JSON NOT NULL,
  `chainDepth` INT NOT NULL DEFAULT 0,
  `visitedWorkflowUuids` JSON NOT NULL,
  `attemptCount` INT NOT NULL DEFAULT 0,
  `maxAttempts` INT NOT NULL DEFAULT 3,
  `retryAt` DATETIME(3) NULL,
  `leaseUntil` DATETIME(3) NULL,
  `claimedBy` VARCHAR(120) NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `lastErrorCode` VARCHAR(80) NULL,
  `lastErrorMessage` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_workflow_executions_uuid_key` (`uuid`),
  UNIQUE KEY `automation_workflow_executions_version_event_key` (`workflowVersionUuid`, `eventId`),
  KEY `automation_workflow_executions_state_retry_created_idx` (`state`, `retryAt`, `createdAt`),
  KEY `automation_workflow_executions_lease_state_idx` (`leaseUntil`, `state`),
  KEY `automation_workflow_executions_workflow_state_created_idx` (`workflowUuid`, `state`, `createdAt`),
  KEY `automation_workflow_executions_entity_created_idx` (`entityType`, `entityUuid`, `createdAt`),
  CONSTRAINT `automation_workflow_executions_workflowUuid_fkey`
    FOREIGN KEY (`workflowUuid`) REFERENCES `automation_workflows` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `automation_workflow_executions_workflowVersionUuid_fkey`
    FOREIGN KEY (`workflowVersionUuid`) REFERENCES `automation_workflow_versions` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_action_executions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `executionUuid` CHAR(36) NOT NULL,
  `nodeId` VARCHAR(120) NOT NULL,
  `actionType` VARCHAR(60) NOT NULL,
  `state` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `input` JSON NOT NULL,
  `output` JSON NULL,
  `resultReference` VARCHAR(180) NULL,
  `attempt` INT NOT NULL DEFAULT 0,
  `maxAttempts` INT NOT NULL DEFAULT 3,
  `availableAt` DATETIME(3) NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `leaseUntil` DATETIME(3) NULL,
  `claimedBy` VARCHAR(120) NULL,
  `errorCode` VARCHAR(80) NULL,
  `errorMessage` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_action_executions_uuid_key` (`uuid`),
  UNIQUE KEY `automation_action_executions_execution_node_key` (`executionUuid`, `nodeId`),
  KEY `automation_action_executions_state_available_created_idx` (`state`, `availableAt`, `createdAt`),
  KEY `automation_action_executions_lease_state_idx` (`leaseUntil`, `state`),
  CONSTRAINT `automation_action_executions_executionUuid_fkey`
    FOREIGN KEY (`executionUuid`) REFERENCES `automation_workflow_executions` (`uuid`) ON UPDATE CASCADE ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_assignment_rules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `workflowUuid` CHAR(36) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `criteria` JSON NOT NULL,
  `strategy` VARCHAR(40) NOT NULL,
  `fallback` JSON NULL,
  `activeFrom` DATETIME(3) NULL,
  `activeUntil` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_assignment_rules_uuid_key` (`uuid`),
  KEY `automation_assignment_rules_workflow_active_idx` (`workflowUuid`, `isActive`),
  CONSTRAINT `automation_assignment_rules_workflowUuid_fkey`
    FOREIGN KEY (`workflowUuid`) REFERENCES `automation_workflows` (`uuid`) ON UPDATE CASCADE ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_sla_policies` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `workflowUuid` CHAR(36) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `targetEntityType` VARCHAR(60) NOT NULL,
  `startEventType` VARCHAR(80) NOT NULL,
  `stopEventTypes` JSON NOT NULL,
  `durationMinutes` INT NOT NULL,
  `timezone` VARCHAR(80) NOT NULL,
  `businessHours` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `version` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_sla_policies_uuid_key` (`uuid`),
  KEY `automation_sla_policies_workflow_active_idx` (`workflowUuid`, `isActive`),
  CONSTRAINT `automation_sla_policies_workflowUuid_fkey`
    FOREIGN KEY (`workflowUuid`) REFERENCES `automation_workflows` (`uuid`) ON UPDATE CASCADE ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_sla_instances` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `policyUuid` CHAR(36) NOT NULL,
  `entityType` VARCHAR(60) NOT NULL,
  `entityUuid` CHAR(36) NOT NULL,
  `policyVersion` INT NOT NULL,
  `startedAt` DATETIME(3) NOT NULL,
  `deadlineAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `breachedAt` DATETIME(3) NULL,
  `state` VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  `leaseUntil` DATETIME(3) NULL,
  `claimedBy` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_sla_instances_uuid_key` (`uuid`),
  UNIQUE KEY `automation_sla_instances_policy_entity_started_key` (`policyUuid`, `entityUuid`, `startedAt`),
  KEY `automation_sla_instances_state_deadline_idx` (`state`, `deadlineAt`),
  KEY `automation_sla_instances_entity_state_idx` (`entityType`, `entityUuid`, `state`),
  CONSTRAINT `automation_sla_instances_policyUuid_fkey`
    FOREIGN KEY (`policyUuid`) REFERENCES `automation_sla_policies` (`uuid`) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_escalation_policies` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `workflowUuid` CHAR(36) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `levels` JSON NOT NULL,
  `maxAttempts` INT NOT NULL DEFAULT 3,
  `cooldownSeconds` INT NOT NULL DEFAULT 3600,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_escalation_policies_uuid_key` (`uuid`),
  KEY `automation_escalation_policies_workflow_active_idx` (`workflowUuid`, `isActive`),
  CONSTRAINT `automation_escalation_policies_workflowUuid_fkey`
    FOREIGN KEY (`workflowUuid`) REFERENCES `automation_workflows` (`uuid`) ON UPDATE CASCADE ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `automation_notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `userUuid` CHAR(36) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `body` TEXT NOT NULL,
  `entityType` VARCHAR(60) NULL,
  `entityUuid` CHAR(36) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'UNREAD',
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `automation_notifications_uuid_key` (`uuid`),
  KEY `automation_notifications_user_status_created_idx` (`userUuid`, `status`, `createdAt`),
  KEY `automation_notifications_entity_created_idx` (`entityType`, `entityUuid`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
