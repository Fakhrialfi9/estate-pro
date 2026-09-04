import { describe, expect, it } from 'vitest';
import {
  SYSTEM_SETTINGS,
  parseSettingValue,
  settingDefinition,
} from '../../src/modules/system/domain/settings.registry.js';

describe('System settings registry', () => {
  it('keeps keys unique and typed', () => {
    const keys = SYSTEM_SETTINGS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(settingDefinition('system.max_page_size')?.valueType).toBe(
      'INTEGER',
    );
  });

  it('rejects unsafe setting values', () => {
    const definition = settingDefinition('system.max_page_size');
    expect(definition).toBeDefined();
    expect(() => parseSettingValue(definition!, 'not-a-number')).toThrow();
    expect(() => parseSettingValue(definition!, '10001')).toThrow();
  });

  it('accepts constrained boolean and URL values', () => {
    expect(
      parseSettingValue(settingDefinition('system.maintenance_mode')!, 'false'),
    ).toBe('false');
    expect(
      parseSettingValue(
        settingDefinition('system.public_status_url')!,
        'https://status.example.com',
      ),
    ).toBe('https://status.example.com/');
  });
});
