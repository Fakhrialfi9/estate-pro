import type { SystemSettingRecord } from '../system.types.js';

export const SYSTEM_SETTINGS_REPOSITORY = Symbol('SYSTEM_SETTINGS_REPOSITORY');

export interface SystemSettingsRepository {
  get(
    key: string,
    scope: string,
    scopeKey: string,
  ): Promise<SystemSettingRecord | null>;
  list(
    scope: string,
    scopeKey: string,
    page: number,
    limit: number,
  ): Promise<{
    items: readonly SystemSettingRecord[];
    total: number;
  }>;
  upsert(input: {
    key: string;
    scope: string;
    scopeKey: string;
    valueType: string;
    value: string;
    mutable: boolean;
    expectedVersion?: number;
  }): Promise<SystemSettingRecord>;
}
