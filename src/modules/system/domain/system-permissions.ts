export const SYSTEM_PERMISSIONS = {
  SETTINGS_READ: 'system.settings.read',
  SETTINGS_UPDATE: 'system.settings.update',
  ACTIVITY_READ: 'system.activity.read',
} as const;

export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[keyof typeof SYSTEM_PERMISSIONS];
