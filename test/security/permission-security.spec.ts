import { describe, expect, it } from 'vitest';
import {
  PermissionAuthorizationPolicy,
  type PermissionActor,
} from '../../src/modules/permissions/application/policies/permission-authorization.policy.js';
import { SystemPermissionProtectedException } from '../../src/modules/permissions/domain/errors/permission.errors.js';

const actor = (permissions: string[]): PermissionActor => ({
  userUuid: 'd7bd8c39-3e51-4a03-953d-5f42c9ea1ab5',
  permissions,
});

describe('Permission authorization security', () => {
  const policy = new PermissionAuthorizationPolicy();

  it('denies regular users permission management', () => {
    expect(() => policy.canManage(actor([]))).toThrow(
      'FORBIDDEN_PERMISSION_OPERATION',
    );
  });

  it('denies protected permission management without elevated authorization', () => {
    expect(() =>
      policy.canManage(actor(['permissions:manage']), 'permissions:manage:protected'),
    ).toThrow(SystemPermissionProtectedException);
  });

  it('does not let an ordinary management capability bypass protected permission policy', () => {
    expect(() =>
      policy.canManage(actor(['permissions:manage']), 'roles:manage:protected'),
    ).toThrow(SystemPermissionProtectedException);
  });

  it('allows protected lifecycle only to the dedicated capability', () => {
    expect(() =>
      policy.canManage(
        actor(['permissions:manage', 'permissions:manage:protected']),
        'permissions:manage:protected',
      ),
    ).not.toThrow();
  });
});
