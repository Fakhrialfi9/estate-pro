import { createHash } from 'node:crypto';

import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';

const ADMIN_UUID = '00000000-0000-5000-8000-000000000001';

function checksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function seedAutomation(tx: SeedTransaction): Promise<void> {
  const workflowUuid = seedUuid('automation-workflow', 'lead-follow-up');
  const versionUuid = seedUuid('automation-workflow-version', 'lead-follow-up:1');
  const workflow = await tx.automationWorkflow.upsert({
    where: { uuid: workflowUuid },
    update: { name: 'Qualified Lead Follow-up', description: 'Seed workflow for qualified lead follow-up.', status: 'ACTIVE', ownerUserUuid: ADMIN_UUID, activeVersionUuid: versionUuid, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
    create: { uuid: workflowUuid, name: 'Qualified Lead Follow-up', description: 'Seed workflow for qualified lead follow-up.', status: 'ACTIVE', ownerUserUuid: ADMIN_UUID, activeVersionUuid: versionUuid, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
  });
  const definition = { nodes: [{ id: 'notify-owner', action: 'NOTIFY_OWNER' }], version: 1 };
  const triggerDefinition = { eventType: 'crm.lead.qualified' };
  const version = await tx.automationWorkflowVersion.upsert({
    where: { workflowUuid_version: { workflowUuid: workflow.uuid, version: 1 } },
    update: { uuid: versionUuid, status: 'ACTIVE', triggerDefinition, definition, checksum: checksum(definition), createdBy: ADMIN_UUID, activatedAt: SEED_REFERENCE_DATE },
    create: { uuid: versionUuid, workflowUuid: workflow.uuid, version: 1, status: 'ACTIVE', triggerDefinition, definition, checksum: checksum(definition), createdBy: ADMIN_UUID, activatedAt: SEED_REFERENCE_DATE },
  });
  await tx.automationAssignmentRule.upsert({
    where: { uuid: seedUuid('automation-assignment-rule', workflow.uuid) },
    update: { workflowUuid: workflow.uuid, name: 'Assign qualified leads to owner', criteria: { leadStatus: 'QUALIFIED' }, strategy: 'OWNER', fallback: { userUuid: ADMIN_UUID }, activeFrom: SEED_REFERENCE_DATE, activeUntil: null, isActive: true },
    create: { uuid: seedUuid('automation-assignment-rule', workflow.uuid), workflowUuid: workflow.uuid, name: 'Assign qualified leads to owner', criteria: { leadStatus: 'QUALIFIED' }, strategy: 'OWNER', fallback: { userUuid: ADMIN_UUID }, activeFrom: SEED_REFERENCE_DATE, isActive: true },
  });
  const slaPolicyUuid = seedUuid('automation-sla-policy', workflow.uuid);
  const slaPolicy = await tx.automationSlaPolicy.upsert({
    where: { uuid: slaPolicyUuid },
    update: { workflowUuid: workflow.uuid, name: 'Qualified Lead Response SLA', targetEntityType: 'CRM_LEAD', startEventType: 'crm.lead.qualified', stopEventTypes: ['crm.lead.contacted'], durationMinutes: 60, timezone: 'Asia/Jakarta', businessHours: { weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }, isActive: true, version: 1 },
    create: { uuid: slaPolicyUuid, workflowUuid: workflow.uuid, name: 'Qualified Lead Response SLA', targetEntityType: 'CRM_LEAD', startEventType: 'crm.lead.qualified', stopEventTypes: ['crm.lead.contacted'], durationMinutes: 60, timezone: 'Asia/Jakarta', businessHours: { weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }, isActive: true, version: 1 },
  });
  await tx.automationSlaInstance.upsert({
    where: { policyUuid_entityUuid_startedAt: { policyUuid: slaPolicy.uuid, entityUuid: seedUuid('crm-lead', 'LEAD-SEED-001'), startedAt: SEED_REFERENCE_DATE } },
    update: { entityType: 'CRM_LEAD', policyVersion: 1, deadlineAt: new Date('2026-01-01T01:00:00.000Z'), state: 'RUNNING' },
    create: { uuid: seedUuid('automation-sla-instance', 'lead-qualified'), policyUuid: slaPolicy.uuid, entityType: 'CRM_LEAD', entityUuid: seedUuid('crm-lead', 'LEAD-SEED-001'), policyVersion: 1, startedAt: SEED_REFERENCE_DATE, deadlineAt: new Date('2026-01-01T01:00:00.000Z'), state: 'RUNNING' },
  });
  await tx.automationEscalationPolicy.upsert({
    where: { uuid: seedUuid('automation-escalation-policy', workflow.uuid) },
    update: { workflowUuid: workflow.uuid, name: 'Qualified Lead Escalation', levels: [{ afterMinutes: 60, action: 'NOTIFY_OWNER' }, { afterMinutes: 120, action: 'NOTIFY_MANAGER' }], maxAttempts: 3, cooldownSeconds: 3600, isActive: true },
    create: { uuid: seedUuid('automation-escalation-policy', workflow.uuid), workflowUuid: workflow.uuid, name: 'Qualified Lead Escalation', levels: [{ afterMinutes: 60, action: 'NOTIFY_OWNER' }, { afterMinutes: 120, action: 'NOTIFY_MANAGER' }], maxAttempts: 3, cooldownSeconds: 3600, isActive: true },
  });
  const templateUuid = seedUuid('automation-notification-template', 'CRM_LEAD_QUALIFIED:1');
  const template = await tx.automationNotificationTemplate.upsert({
    where: { code_version: { code: 'CRM_LEAD_QUALIFIED', version: 1 } },
    update: { uuid: templateUuid, titleTemplate: 'Qualified lead requires follow-up', bodyTemplate: 'A qualified lead requires your attention.', variables: ['leadUuid', 'contactName'], isActive: true },
    create: { uuid: templateUuid, code: 'CRM_LEAD_QUALIFIED', version: 1, titleTemplate: 'Qualified lead requires follow-up', bodyTemplate: 'A qualified lead requires your attention.', variables: ['leadUuid', 'contactName'], isActive: true },
  });
  await tx.automationNotificationPreference.upsert({
    where: { userUuid_notificationType_channel: { userUuid: ADMIN_UUID, notificationType: 'CRM_LEAD_QUALIFIED', channel: 'IN_APP' } },
    update: { enabled: true },
    create: { uuid: seedUuid('automation-notification-preference', 'admin:CRM_LEAD_QUALIFIED:IN_APP'), userUuid: ADMIN_UUID, notificationType: 'CRM_LEAD_QUALIFIED', channel: 'IN_APP', enabled: true },
  });
  const notification = await tx.automationNotification.upsert({
    where: { uuid: seedUuid('automation-notification', 'lead-qualified') },
    update: { userUuid: ADMIN_UUID, type: 'CRM_LEAD_QUALIFIED', title: 'Qualified lead requires follow-up', body: 'Seed notification for CRM workflow testing.', entityType: 'CRM_LEAD', entityUuid: seedUuid('crm-lead', 'LEAD-SEED-001'), status: 'UNREAD', readAt: null },
    create: { uuid: seedUuid('automation-notification', 'lead-qualified'), userUuid: ADMIN_UUID, type: 'CRM_LEAD_QUALIFIED', title: 'Qualified lead requires follow-up', body: 'Seed notification for CRM workflow testing.', entityType: 'CRM_LEAD', entityUuid: seedUuid('crm-lead', 'LEAD-SEED-001'), status: 'UNREAD' },
  });
  await tx.automationNotificationPolicy.upsert({
    where: { notificationUuid: notification.uuid },
    update: { templateUuid: template.uuid, priority: 'NORMAL', expiresAt: new Date('2026-12-31T23:59:59.000Z') },
    create: { uuid: seedUuid('automation-notification-policy', notification.uuid), notificationUuid: notification.uuid, templateUuid: template.uuid, priority: 'NORMAL', expiresAt: new Date('2026-12-31T23:59:59.000Z') },
  });
  await tx.automationNotificationDelivery.upsert({
    where: { notificationUuid_channel: { notificationUuid: notification.uuid, channel: 'IN_APP' } },
    update: { state: 'QUEUED', attemptCount: 0, maxAttempts: 3, availableAt: SEED_REFERENCE_DATE, sentAt: null, providerMessageId: null, errorMessage: null },
    create: { uuid: seedUuid('automation-notification-delivery', `${notification.uuid}:IN_APP`), notificationUuid: notification.uuid, channel: 'IN_APP', state: 'QUEUED', attemptCount: 0, maxAttempts: 3, availableAt: SEED_REFERENCE_DATE },
  });

  const executionUuid = seedUuid('automation-execution', 'lead-qualified');
  const execution = await tx.automationWorkflowExecution.upsert({
    where: { uuid: executionUuid },
    update: { workflowUuid: workflow.uuid, workflowVersionUuid: version.uuid, eventId: seedUuid('crm-lead', 'LEAD-SEED-001'), eventType: 'crm.lead.qualified', entityType: 'CRM_LEAD', entityUuid: seedUuid('crm-lead', 'LEAD-SEED-001'), state: 'COMPLETED', currentNodeId: 'notify-owner', contextSnapshot: { leadUuid: seedUuid('crm-lead', 'LEAD-SEED-001') }, chainDepth: 0, visitedWorkflowUuids: [workflow.uuid], attemptCount: 1, maxAttempts: 3, startedAt: SEED_REFERENCE_DATE, completedAt: new Date('2026-01-01T00:01:00.000Z') },
    create: { uuid: executionUuid, workflowUuid: workflow.uuid, workflowVersionUuid: version.uuid, eventId: seedUuid('crm-lead', 'LEAD-SEED-001'), eventType: 'crm.lead.qualified', entityType: 'CRM_LEAD', entityUuid: seedUuid('crm-lead', 'LEAD-SEED-001'), state: 'COMPLETED', currentNodeId: 'notify-owner', contextSnapshot: { leadUuid: seedUuid('crm-lead', 'LEAD-SEED-001') }, chainDepth: 0, visitedWorkflowUuids: [workflow.uuid], attemptCount: 1, maxAttempts: 3, startedAt: SEED_REFERENCE_DATE, completedAt: new Date('2026-01-01T00:01:00.000Z') },
  });
  await tx.automationActionExecution.upsert({
    where: { executionUuid_nodeId: { executionUuid: execution.uuid, nodeId: 'notify-owner' } },
    update: { actionType: 'NOTIFY_OWNER', state: 'SUCCEEDED', input: { notificationUuid: notification.uuid }, output: { queued: true }, resultReference: notification.uuid, attempt: 1, maxAttempts: 3, startedAt: SEED_REFERENCE_DATE, completedAt: new Date('2026-01-01T00:01:00.000Z') },
    create: { uuid: seedUuid('automation-action-execution', execution.uuid), executionUuid: execution.uuid, nodeId: 'notify-owner', actionType: 'NOTIFY_OWNER', state: 'SUCCEEDED', input: { notificationUuid: notification.uuid }, output: { queued: true }, resultReference: notification.uuid, attempt: 1, maxAttempts: 3, startedAt: SEED_REFERENCE_DATE, completedAt: new Date('2026-01-01T00:01:00.000Z') },
  });
}
