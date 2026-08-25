import { describe, expect, it } from 'vitest';
import { RoleEntity, normalizeRoleCode, normalizeRoleName } from '../../../src/modules/roles/domain/entities/role.entity.js';

const base = (overrides: Partial<Parameters<typeof RoleEntity.create>[0]> = {}) => ({
  uuid: '4f7d2c31-6f40-4fa8-9b79-1c99d9af1f12',
  name: 'Admin Support',
  code: 'admin-support',
  description: null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  isSystem: false,
  ...overrides,
});

describe('RoleEntity', () => {
  it('normalizes display name and stable code', () => {
    expect(normalizeRoleName('  Admin   Support  ')).toBe('Admin Support');
    expect(normalizeRoleCode(' ADMIN-SUPPORT ')).toBe('admin-support');
  });

  it('protects system roles from deactivation', () => {
    expect(() => RoleEntity.create(base({ code: 'admin', name: 'Admin', isSystem: true, isActive: false }))).toThrow('System role must remain active');
  });

  it('preserves a stable code when the display name changes', () => {
    const role = RoleEntity.create(base({ code: 'admin-support' }));
    role.update({ name: 'Support Administrator' });
    expect(role.name).toBe('Support Administrator');
    expect(role.code).toBe('admin-support');
  });

  it('rejects malformed role codes', () => {
    expect(() => RoleEntity.create(base({ code: "admin'; DROP TABLE roles; --" }))).toThrow('Invalid role code');
    expect(() => RoleEntity.create(base({ code: '../../../admin' }))).toThrow('Invalid role code');
  });

  it('rejects whitespace-only names', () => {
    expect(() => RoleEntity.create(base({ name: '   ' }))).toThrow('Invalid role name');
  });
});
