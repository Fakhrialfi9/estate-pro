import { createHash } from 'node:crypto';

import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';

const ADMIN_UUID = '00000000-0000-5000-8000-000000000001';

function checksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function seedAutomation(tx: SeedTransaction): Promise<void> {
  const workflowUuid = seedUuid('automation-workflow', 'lead-follow-up');
  const workflow = await tx.automationWorkflow.upsert({
    where: { uuid: workflowUuid },
    update: { name: 'Qualified Lead Follow-up', description: 'Seed workflow for qualified lead follow-up.', status: 'ACTIVE', ownerUserUuid: ADMIN_UUID, activeVersionUuid: seedUuid('automation-workflow-version', 'lead-follow-up:1'), createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
    create: { uuid: workflowUuid, name: 'Qualified Lead Follow-up', description: 'Seed workflow for qualified lead follow-up.', status: 'ACTIVE', ownerUserUuid: ADMIN_UUID, activeVersionUuid: seedUuid('automation-workflow-version', 'lead-follow-up:1'), createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
  });
  const definition = { nodes: [{ id: 'notify-owner', action: 'NOTIFY_OWNER' }], version: 1 };
  const triggerDefinition = { eventType: 'crm.lead.qualified' };
  const version = await tx.automationWorkflowVersion.upsert({
    where: { workflowUuid_version: { workflowUuid: workflow.uuid, version: 1 } },
    update: { uuid: seedUuid('automation-workflow-version', 'lead-follow-up:1'), status: 'ACTIVE', triggerDefinition, definition, checksum: checksum(definition), createdBy: ADMIN_UUID, activatedAt: SEED_REFERENCE_DATE },
    create: { uuid: seedUuid('automation-workflow-version', 'lead-follow-up:1'), workflowUuid: workflow.uuid, version: 1, status: 'ACTIVE', triggerDefinition, definition, checksum: checksum(definition), createdBy: ADMIN_UUID, activatedAt: SEED_REFERENCE_DATE },
  });
  await tx.automationAssignmentRule.upsert({
    where: { uuid: seedUuid('automation-assignment-rule', workflow.uuid) },
    update: { workflowUuid: workflow.uuid, name: 'Assign qualified leads to owner', criteria: { leadStatus: 'QUALIFIED' }, strategy: 'OWNER', fallback: { userUuid: ADMIN_UUID }, activeFrom: SEED_REFERENCE_DATE, activeUntil: null, isActive: true },
    create: { uuid: seedUuid('automation-assignment-rule', workflow.uuid), workflowUuid: workflow.uuid, name: 'Assign qualified leads to owner', criteria: { leadStatus: 'QUALIFIED' }, strategy: 'OWNER', fallback: { userUuid: ADMIN_UUID }, activeFrom: SEED_REFERENCE_DATE, isActive: true },
  });
  await tx.automationSlaPolicy.upsert({
    where: { uuid: seedUuid('automation-sla-policy', workflow.uuid) },
    update: { workflowUuid: workflow.uuid, name: 'Qualified Lead Response SLA', targetEntityType: 'CRM_LEAD', startEventType: 'crm.lead.qualified', stopEventTypes: ['crm.lead.contacted'], durationMinutes: 60, timezone: 'Asia/Jakarta', businessHours: { weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }, isActive: true, version: 1 },
    create: { uuid: seedUuid('automation-sla-policy', workflow.uuid), workflowUuid: workflow.uuid, name: 'Qualified Lead Response SLA', targetEntityType: 'CRM_LEAD', startEventType: 'crm.lead.qualified', stopEventTypes: ['crm.lead.contacted'], durationMinutes: 60, timezone: 'Asia/Jakarta', businessHours: { weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }, isActive: true, version: 1 },
  });
  await tx.automationEscalationPolicy.upsert({
    where: { uuid: seedUuid('automation-escalation-policy', workflow.uuid) },
    update: { workflowUuid: workflow.uuid, name: 'Qualified Lead Escalation', levels: [{ afterMinutes: 60, action: 'NOTIFY_OWNER' }, { afterMinutes: 120, action: 'NOTIFY_MANAGER' }], maxAttempts: 3, cooldownSeconds: 3600, isActive: true },
    create: { uuid: seedUuid('automation-escalation-policy', workflow.uuid), workflowUuid: workflow.uuid, name: 'Qualified Lead Escalation', levels: [{ afterMinutes: 60, action: 'NOTIFY_OWNER' }, { afterMinutes: 120, action: 'NOTIFY_MANAGER' }], maxAttempts: 3, cooldownSeconds: 3600, isActive: true },
  });
  const template = await tx.automationNotificationTemplate.upsert({
    where: { code_version: { code: 'CRM_LEAD_QUALIFIED', version: 1 } },
    update: { titleTemplate: 'Qualified lead requires follow-up', bodyTemplate: 'A qualified lead requires your attention.', variables: ['leadUuid', 'contactName'], isActive: true },
    create: { uuid: seedUuid('automation-notification-template', 'CRM_LEAD_QUALIFIED:1'), code: 'CRM_LEAD_QUALIFIED', version: 1, titleTemplate: 'Qualified lead requires follow-up', bodyTemplate: 'A qualified lead requires your attention.', variables: ['leadUuid', 'contactName'], isActive: true },
  });
  await tx.automationNotificationPreference.upsert({
    where: { userUuid_notificationType_channel: { userUuid: ADMIN_UUID, notificationType: 'CRM_LEAD_QUALIFIED', channel: 'IN_APP' } },
    update: { enabled: true },
    create: { uuid: seedUuid('automation-notification-preference', 'admin:CRM_LEAD_QUALIFIED:IN_APP'), userUuid: ADMIN_UUID, notificationType: 'CRM_LEAD_QUALIFIED', channel: 'IN_APP', enabled: true },
  });
  await tx.automationNotification.upsert({
    where: { uuid: seedUuid('automation-notification', 'lead-qualified') },
    update: { userUuid: ADMIN_UUID, type: 'CRM_LEAD_QUALIFIED', title: 'Qualified lead requires follow-up', body: 'Seed notification for CRM workflow testing.', entityType: 'CRM_LEAD', entityUuid: seedUuid('crm-lead', 'LEAD-SEED-001'), status: 'UNREAD', readAt: null },
    create: { uuid: seedUuid('automation-notification', 'lead-qualified'), userUuid: ADMIN_UUID, type: 'CRM_LEAD_QUALIFIED', title: 'Qualified lead requires follow-up', body: 'Seed notification for CRM workflow testing.', entityType: 'CRM_LEAD', entityUuid: seedUuid('crm-lead', 'LEAD-SEED-001'), status: 'UNREAD' },
  });
  void version;
  void template;
}
