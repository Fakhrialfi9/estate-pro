import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import {
  RoleManageAccessGuard,
  RoleReadAccessGuard,
} from '../../../src/modules/roles/security/role-management-access.guard.js';
import type { UserAuthorizationRepository } from '../../../src/common/security/authorization.repository.js';

const actorUuid = '11111111-1111-4111-8111-111111111111';

const context = (request: {
  user?: { sub?: string; permissions?: string[] };
}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

const repository = (
  permissions: string[],
  roles: string[] = ['user'],
) => {
  const listPermissionCodes = vi.fn().mockResolvedValue(permissions);
  const getAuthorizationSnapshot = vi.fn().mockResolvedValue({
    userUuid: actorUuid,
    roleCodes: roles,
    permissionCodes: permissions,
  });
  const authorization: UserAuthorizationRepository = {
    listPermissionCodes,
    getAuthorizationSnapshot,
  };
  return { authorization, getAuthorizationSnapshot };
};

describe('Role access guards', () => {
  it('rejects management without roles:manage', async () => {
    const { authorization } = repository([]);
    await expect(
      new RoleManageAccessGuard(authorization).canActivate(
        context({ user: { sub: actorUuid } }),
      ),
    ).rejects.toThrow();
  });

  it('allows management with authoritative roles:manage', async () => {
    const { authorization, getAuthorizationSnapshot } = repository([
      'roles:manage',
    ]);
    const request = {
      user: { sub: actorUuid, permissions: ['spoofed:admin'] },
    };

    await expect(
      new RoleManageAccessGuard(authorization).canActivate(context(request)),
    ).resolves.toBe(true);

    expect(getAuthorizationSnapshot).toHaveBeenCalledWith(actorUuid);
    expect(request.user.permissions).toEqual(['roles:manage']);
  });

  it('allows read with roles:read or roles:manage', async () => {
    const read = repository(['roles:read']);
    await expect(
      new RoleReadAccessGuard(read.authorization).canActivate(
        context({ user: { sub: actorUuid } }),
      ),
    ).resolves.toBe(true);

    const manage = repository(['roles:manage']);
    await expect(
      new RoleReadAccessGuard(manage.authorization).canActivate(
        context({ user: { sub: actorUuid } }),
      ),
    ).resolves.toBe(true);
  });

  it('returns 401 semantics when the authenticated principal is missing', async () => {
    const { authorization } = repository(['roles:read']);
    await expect(
      new RoleReadAccessGuard(authorization).canActivate(context({})),
    ).rejects.toThrow();
  });

  it('resolves authoritative permissions even when the token has no permission claim', async () => {
    const { authorization, getAuthorizationSnapshot } = repository([
      'roles:manage',
      'roles:manage:protected',
    ]);
    const request = { user: { sub: actorUuid } };

    const result = await new RoleManageAccessGuard(authorization).canActivate(
      context(request),
    );

    expect(result).toBe(true);
    expect(getAuthorizationSnapshot).toHaveBeenCalledWith(actorUuid);
    expect(request.user.permissions).toEqual([
      'roles:manage',
      'roles:manage:protected',
    ]);
  });

  it('does not trust a spoofed permission claim on the request', async () => {
    const { authorization, getAuthorizationSnapshot } = repository([]);
    const request = { user: { sub: actorUuid, permissions: ['roles:manage'] } };

    await expect(
      new RoleManageAccessGuard(authorization).canActivate(context(request)),
    ).rejects.toThrow();
    expect(getAuthorizationSnapshot).toHaveBeenCalledWith(actorUuid);
  });
});
