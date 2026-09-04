import type { SystemSettingValueType } from './system.types.js';

export interface SystemSettingDefinition {
  readonly key: string;
  readonly valueType: SystemSettingValueType;
  readonly scope: 'GLOBAL';
  readonly mutable: boolean;
  readonly description: string;
}

export const SYSTEM_SETTINGS: readonly SystemSettingDefinition[] = [
  {
    key: 'system.default_page_size',
    valueType: 'INTEGER',
    scope: 'GLOBAL',
    mutable: true,
    description: 'Default page size for System read APIs.',
  },
  {
    key: 'system.max_page_size',
    valueType: 'INTEGER',
    scope: 'GLOBAL',
    mutable: true,
    description: 'Maximum page size accepted by System read APIs.',
  },
  {
    key: 'system.maintenance_mode',
    valueType: 'BOOLEAN',
    scope: 'GLOBAL',
    mutable: true,
    description: 'Whether maintenance mode is enabled for System operations.',
  },
  {
    key: 'system.public_status_url',
    valueType: 'URL',
    scope: 'GLOBAL',
    mutable: true,
    description: 'Canonical public status URL used by operational tooling.',
  },
] as const;

export const SETTING_DEFAULTS: Readonly<Record<string, string>> = {
  'system.default_page_size': '25',
  'system.max_page_size': '100',
  'system.maintenance_mode': 'false',
};

export const settingDefinition = (key: string): SystemSettingDefinition | undefined =>
  SYSTEM_SETTINGS.find((definition) => definition.key === key);

export const parseSettingValue = (
  definition: SystemSettingDefinition,
  value: string,
): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error('Setting value is required');
  switch (definition.valueType) {
    case 'INTEGER': {
      if (!/^\d+$/.test(normalized)) throw new Error('Setting must be an integer');
      const parsed = Number(normalized);
      if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10000)
        throw new Error('Setting integer is out of range');
      return String(parsed);
    }
    case 'BOOLEAN': {
      if (normalized !== 'true' && normalized !== 'false')
        throw new Error('Setting must be a boolean');
      return normalized;
    }
    case 'URL': {
      const url = new URL(normalized);
      if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Setting URL protocol is not allowed');
      return url.toString();
    }
    case 'STRING':
      return normalized.slice(0, 4000);
  }
};
