export class SystemSettingNotFoundError extends Error {
  readonly code = 'SYSTEM_SETTING_NOT_FOUND';
  constructor(key: string) {
    super(`System setting not found: ${key}`);
    this.name = 'SystemSettingNotFoundError';
  }
}

export class SystemSettingImmutableError extends Error {
  readonly code = 'SYSTEM_SETTING_IMMUTABLE';
  constructor(key: string) {
    super(`System setting is immutable: ${key}`);
    this.name = 'SystemSettingImmutableError';
  }
}

export class SystemSettingConflictError extends Error {
  readonly code = 'SYSTEM_SETTING_CONFLICT';
  constructor(key: string) {
    super(`System setting was modified concurrently: ${key}`);
    this.name = 'SystemSettingConflictError';
  }
}
