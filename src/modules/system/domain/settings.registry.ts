import type { SystemSettingValueType } from './system.types.js';

export interface SystemSettingDefinition {
  readonly key: string;
  readonly valueType: SystemSettingValueType;
  readonly scope: 'GLOBAL';
  readonly mutable: boolean;
  readonly sensitive: boolean;
  readonly defaultValue: string;
  readonly description: string;
}

export const SYSTEM_SETTINGS: readonly SystemSettingDefinition[] = [
  {
    key: 'system.default_page_size',
    valueType: 'INTEGER',
    scope: 'GLOBAL',
    mutable: true,
    sensitive: false,
    defaultValue: '25',
    description: 'Default page size for System read APIs.',
  },
  {
    key: 'system.max_page_size',
    valueType: 'INTEGER',
    scope: 'GLOBAL',
    mutable: true,
    sensitive: false,
    defaultValue: '100',
    description: 'Maximum page size accepted by System read APIs.',
  },
  {
    key: 'system.maintenance_mode',
    valueType: 'BOOLEAN',
    scope: 'GLOBAL',
    mutable: true,
    sensitive: false,
    defaultValue: 'false',
    description: 'Whether maintenance mode is enabled for System operations.',
  },
  {
    key: 'system.public_status_url',
    valueType: 'URL',
    scope: 'GLOBAL',
    mutable: true,
    sensitive: false,
    defaultValue: 'https://status.example.com',
    description: 'Canonical public status URL used by operational tooling.',
  },
] as const;

export const SETTING_DEFAULTS: Readonly<Record<string, string>> =
  Object.fromEntries(
    SYSTEM_SETTINGS.map((setting) => [setting.key, setting.defaultValue]),
  );

export const settingDefinition = (key: string) =>
  SYSTEM_SETTINGS.find((setting) => setting.key === key);

export const parseSettingValue = (
  definition: SystemSettingDefinition,
  value: string,
): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error('Setting value is required');

  switch (definition.valueType) {
    case 'INTEGER': {
      if (!/^\d+$/.test(normalized)) {
        throw new Error('Setting must be an integer');
      }
      const parsed = Number(normalized);
      if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10000) {
        throw new Error('Setting integer is out of range');
      }
      return String(parsed);
    }
    case 'BOOLEAN':
      if (normalized !== 'true' && normalized !== 'false') {
        throw new Error('Setting must be a boolean');
      }
      return normalized;
    case 'URL': {
      let url: URL;
      try {
        url = new URL(normalized);
      } catch {
        throw new Error('Setting URL is invalid');
      }
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Setting URL protocol is not allowed');
      }
      return url.toString();
    }
    case 'STRING':
      return normalized.slice(0, 4000);
  }
};
