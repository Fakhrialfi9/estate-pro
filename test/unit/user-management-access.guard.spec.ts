import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UserManagementAccessGuard } from '../../src/modules/users/security/user-management-access.guard.js';

type Scenario = {
  method: string;
  uuid?: string;
  permissions?: string[];
};

function context(scenario: Scenario): ExecutionContext {
  const request = {
    method: scenario.method,
    params: scenario.uuid ? { uuid: scenario.uuid } : {},
    headers: { authorization: 'Bearer test-token' },
    user: undefined,
  };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard(scenario: Scenario, accessible = true) {
  const claims = {
    sub: scenario.uuid ?? 'actor-uuid',
    sid: 'session-id',
    iat: 1,
    exp: 2,
  } as never;

  const verifier = {
    verifyAccessToken: vi.fn().mockResolvedValue(claims),
  };
  const users = {
    getByUuid: vi.fn().mockResolvedValue({
      isAccessible: () => accessible,
    }),
  };
  const authorization = {
    getAuthorizationSnapshot: vi.fn().mockResolvedValue({
      userUuid: scenario.uuid ?? 'actor-uuid',
      roleCodes: [],
      permissionCodes: scenario.permissions ?? [],
    }),
  };

  return {
    guard: new UserManagementAccessGuard(
      verifier,
      authorization as never,
      users as never,
    ),
    verifier,
    users,
    authorization,
  };
}

describe('UserManagementAccessGuard', () => {
  it('allows a user to read their own resource without management permission', async () => {
    const scenario = {
      method: 'GET',
      uuid: 'actor-uuid',
    } satisfies Scenario;
    const { guard } = createGuard(scenario);

    await expect(guard.canActivate(context(scenario))).resolves.toBe(true);
  });

  it('requires users.read for collection reads', async () => {
    const withoutPermission = {
      method: 'GET',
    } satisfies Scenario;
    const withPermission = {
      ...withoutPermission,
      permissions: ['users.read'],
    } satisfies Scenario;

    await expect(
      createGuard(withoutPermission).guard.canActivate(
        context(withoutPermission),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      createGuard(withPermission).guard.canActivate(context(withPermission)),
    ).resolves.toBe(true);
  });

  it.each([
    ['POST', 'users.create'],
    ['PATCH', 'users.update'],
    ['PUT', 'users.update'],
    ['DELETE', 'users.delete'],
  ])('requires %s -> %s', async (method, permission) => {
    const withoutPermission = { method } satisfies Scenario;
    const withPermission = {
      method,
      permissions: [permission],
    } satisfies Scenario;

    await expect(
      createGuard(withoutPermission).guard.canActivate(
        context(withoutPermission),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      createGuard(withPermission).guard.canActivate(context(withPermission)),
    ).resolves.toBe(true);
  });

  it('returns unauthorized when the access token cannot be verified', async () => {
    const scenario = { method: 'GET' } satisfies Scenario;
    const { guard, verifier } = createGuard(scenario);
    verifier.verifyAccessToken.mockRejectedValue(new Error('invalid token'));

    await expect(guard.canActivate(context(scenario))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns unauthorized when the actor is not accessible', async () => {
    const scenario = {
      method: 'GET',
      permissions: ['users.read'],
    } satisfies Scenario;
    const { guard } = createGuard(scenario, false);

    await expect(guard.canActivate(context(scenario))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
