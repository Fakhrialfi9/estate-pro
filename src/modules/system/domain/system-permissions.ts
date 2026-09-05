export const SYSTEM_PERMISSIONS = {
  SETTINGS_READ: 'system.settings.read',
  SETTINGS_UPDATE: 'system.settings.update',
  ACTIVITY_READ: 'system.activity.read',
  DASHBOARD_READ: 'system.dashboard.read',
  FLAGS_READ: 'system.flags.read',
  FLAGS_UPDATE: 'system.flags.update',
  IMPORT_PROFILE_READ: 'system.import.profile.read',
  IMPORT_PROFILE_CREATE: 'system.import.profile.create',
  IMPORT_PROFILE_UPDATE: 'system.import.profile.update',
  INTEGRATION_CREDENTIALS_READ: 'system.integration.credentials.read',
  INTEGRATION_CREDENTIALS_UPDATE: 'system.integration.credentials.update',
  INTEGRATION_RUNTIME_READ: 'system.integration.runtime.read',
  INTEGRATION_RUNTIME_UPDATE: 'system.integration.runtime.update',
  INTEGRATION_OPERATION_READ: 'system.integration.operation.read',
  INTEGRATION_OPERATION_CREATE: 'system.integration.operation.create',
  INTEGRATION_OPERATION_UPDATE: 'system.integration.operation.update',
  INTEGRATION_EVENT_READ: 'system.integration.event.read',
  INTEGRATION_EVENT_CREATE: 'system.integration.event.create',
  INTEGRATION_EVENT_UPDATE: 'system.integration.event.update',
  INTEGRATION_CONFLICT_READ: 'system.integration.conflict.read',
  INTEGRATION_CONFLICT_UPDATE: 'system.integration.conflict.update',
  INTEGRATION_SYNC: 'system.integration.sync',
  ALERT_READ: 'system.alert.read',
  ALERT_UPDATE: 'system.alert.update',
} as const;

export type SystemPermission =
  (typeof SYSTEM_PERMISSIONS)[keyof typeof SYSTEM_PERMISSIONS];
