import { describe, expect, it } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { RoleManageAccessGuard, RoleReadAccessGuard } from '../../../src/modules/roles/security/role-management-access.guard.js';

const context = (permissions: string[]) => ({
  switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'actor-uuid', permissions } }) }),
}) as unknown as ExecutionContext;

describe('Role access guards', () => {
  it('rejects management without roles:manage', () => {
    expect(() => new RoleManageAccessGuard().canActivate(context([]))).toThrow();
  });

  it('allows management with roles:manage', () => {
    expect(new RoleManageAccessGuard().canActivate(context(['roles:manage']))).toBe(true);
  });

  it('allows read with roles:read or roles:manage', () => {
    expect(new RoleReadAccessGuard().canActivate(context(['roles:read']))).toBe(true);
    expect(new RoleReadAccessGuard().canActivate(context(['roles:manage']))).toBe(true);
  });

  it('rejects arbitrary authenticated users', () => {
    expect(() => new RoleReadAccessGuard().canActivate(context([]))).toThrow();
  });
});
