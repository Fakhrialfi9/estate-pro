import { describe, expect, it } from 'vitest';
import {
  buildPermissionCode,
  isProtectedPermissionCode,
  PermissionEntity,
} from '../../../src/modules/permissions/domain/entities/permission.entity.js';

describe('PermissionEntity', () => {
  const base = {
    uuid: '4f7d2c31-6f40-4fa8-9b79-1c99d9af1f12',
    name: 'Read Users',
    code: 'users:users:read',
    module: 'users',
    domain: 'users',
    action: 'read',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('normalizes canonical resource/action identity', () => {
    const permission = PermissionEntity.create({
      ...base,
      code: 'USERS:USERS:READ',
      module: ' USERS ',
      domain: ' Users ',
      action: ' READ ',
    });

    expect(permission.code).toBe('users:users:read');
    expect(permission.resource).toBe('users:users');
    expect(buildPermissionCode(permission.module, permission.domain, permission.action)).toBe(
      permission.code,
    );
  });

  it('derives system protection from the stable identifier', () => {
    const permission = PermissionEntity.create({
      ...base,
      code: 'permissions:manage:protected',
      module: 'permissions',
      domain: 'manage',
      action: 'protected',
    });

    expect(permission.isSystem).toBe(true);
    expect(isProtectedPermissionCode(permission.code)).toBe(true);
  });

  it('does not allow an inconsistent identifier', () => {
    expect(() =>
      PermissionEntity.create({ ...base, code: 'users:users:write' }),
    ).toThrow('Invalid permission identifier');
  });

  it('only permits display-name mutation through update', () => {
    const permission = PermissionEntity.create(base);
    permission.update({ name: 'Updated Users Read' });
    expect(permission.name).toBe('Updated Users Read');
    expect(permission.code).toBe('users:users:read');
  });
});
