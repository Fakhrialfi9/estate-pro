import type { PermissionSeed } from './types.ts';

export const AUTOMATION_PERMISSIONS: readonly PermissionSeed[] = [
  { name: 'Read Automation Workflows', code: 'automation.workflows.read', module: 'automation', domain: 'workflows', action: 'read' },
  { name: 'Create Automation Workflows', code: 'automation.workflows.create', module: 'automation', domain: 'workflows', action: 'create' },
  { name: 'Update Automation Workflows', code: 'automation.workflows.update', module: 'automation', domain: 'workflows', action: 'update' },
  { name: 'Publish Automation Workflows', code: 'automation.workflows.publish', module: 'automation', domain: 'workflows', action: 'publish' },
  { name: 'Activate Automation Workflows', code: 'automation.workflows.activate', module: 'automation', domain: 'workflows', action: 'activate' },
  { name: 'Pause Automation Workflows', code: 'automation.workflows.pause', module: 'automation', domain: 'workflows', action: 'pause' },
  { name: 'Archive Automation Workflows', code: 'automation.workflows.archive', module: 'automation', domain: 'workflows', action: 'archive' },
  { name: 'Execute Automation', code: 'automation.execute', module: 'automation', domain: 'execution', action: 'execute' },
  { name: 'Read Automation Executions', code: 'automation.executions.read', module: 'automation', domain: 'execution', action: 'read' },
  { name: 'Retry Automation Executions', code: 'automation.executions.retry', module: 'automation', domain: 'execution', action: 'retry' },
  { name: 'Cancel Automation Executions', code: 'automation.executions.cancel', module: 'automation', domain: 'execution', action: 'cancel' },
] as const;
