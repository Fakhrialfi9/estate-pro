import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import {
  RoleManageAccessGuard,
  RoleReadAccessGuard,
} from '../../../src/modules/roles/security/role-management-access.guard.js';

const context = (permissions?: string[]) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user:
          permissions === undefined
            ? { sub: 'actor-uuid' }
            : { sub: 'actor-uuid', permissions },
      }),
    }),
  }) as unknown as ExecutionContext;

describe('Role access guards', () => {
  it('rejects management without roles:manage', () => {
    expect(() =>
      new RoleManageAccessGuard().canActivate(context([])),
    ).toThrow();
  });

  it('allows management with roles:manage', () => {
    expect(
      new RoleManageAccessGuard().canActivate(context(['roles:manage'])),
    ).toBe(true);
  });

  it('allows read with roles:read or roles:manage', () => {
    expect(new RoleReadAccessGuard().canActivate(context(['roles:read']))).toBe(
      true,
    );
    expect(
      new RoleReadAccessGuard().canActivate(context(['roles:manage'])),
    ).toBe(true);
  });

  it('rejects arbitrary authenticated users', () => {
    expect(() => new RoleReadAccessGuard().canActivate(context([]))).toThrow();
  });

  it('resolves authoritative permissions when the token has no permission claim', async () => {
    const authorization = {
      listPermissionCodes: vi
        .fn()
        .mockResolvedValue(['roles:manage', 'roles:manage:protected']),
    };
    const executionContext = context();
    const result = await new RoleManageAccessGuard(authorization).canActivate(
      executionContext,
    );

    expect(result).toBe(true);
    expect(authorization.listPermissionCodes).toHaveBeenCalledWith(
      'actor-uuid',
    );
  });
});
