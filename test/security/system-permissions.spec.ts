import { describe, expect, it } from 'vitest';
import { SYSTEM_PERMISSIONS } from '../../src/modules/system/domain/system-permissions.js';

describe('System permission contract', () => {
  it('uses unique least-privilege permission names', () => {
    const values = Object.values(SYSTEM_PERMISSIONS);
    expect(new Set(values).size).toBe(values.length);
    expect(values).not.toContain('*');
    expect(values.every((value) => value.startsWith('system.'))).toBe(true);
  });
});
