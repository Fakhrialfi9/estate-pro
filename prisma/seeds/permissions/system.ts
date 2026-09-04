export const SYSTEM_PERMISSIONS = [
  { name: 'Read System Settings', code: 'system.settings.read', module: 'system', domain: 'settings', action: 'read' },
  { name: 'Update System Settings', code: 'system.settings.update', module: 'system', domain: 'settings', action: 'update' },
  { name: 'Read System Activity', code: 'system.activity.read', module: 'system', domain: 'activity', action: 'read' },
  { name: 'Read System Notifications', code: 'system.notifications.read', module: 'system', domain: 'notifications', action: 'read' },
  { name: 'Read System Jobs', code: 'system.jobs.read', module: 'system', domain: 'jobs', action: 'read' },
  { name: 'Retry System Jobs', code: 'system.jobs.retry', module: 'system', domain: 'jobs', action: 'retry' },
  { name: 'Cancel System Jobs', code: 'system.jobs.cancel', module: 'system', domain: 'jobs', action: 'cancel' },
] as const;
