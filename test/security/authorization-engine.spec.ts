import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationGuard } from '../../src/common/security/authorization.guard.js';
import {
  AUTHORIZATION_PERMISSIONS_METADATA,
  RequirePermissions,
  RequirePermissionsAny,
  RequireRoles,
  RequireRolesAny,
  Public,
} from '../../src/common/security/authorization.decorators.js';
import { AuthorizationService } from '../../src/common/security/authorization.service.js';
import type {
  AuthorizationSnapshot,
  UserAuthorizationRepository,
} from '../../src/common/security/authorization.repository.js';

const snapshot = (
  permissions: string[] = [],
  roles: string[] = [],
): AuthorizationSnapshot => ({
  userUuid: '7e9d9c67-30a5-4d2c-a8df-70755f96ad35',
  permissionCodes: permissions,
  roleCodes: roles,
});

describe('AuthorizationService', () => {
  const repository: UserAuthorizationRepository = {
    listPermissionCodes: vi.fn(),
    getAuthorizationSnapshot: vi.fn(),
  };
  const service = new AuthorizationService(repository);

  it('supports permission AND semantics', () => {
    expect(() =>
      service.assertPermissions(snapshot(['a', 'b']), ['a', 'b'], 'AND'),
    ).not.toThrow();
    expect(() =>
      service.assertPermissions(snapshot(['a']), ['a', 'b'], 'AND'),
    ).toThrow(ForbiddenException);
  });

  it('supports permission OR semantics', () => {
    expect(() =>
      service.assertPermissions(snapshot(['a']), ['a', 'b'], 'OR'),
    ).not.toThrow();
    expect(() =>
      service.assertPermissions(snapshot(['c']), ['a', 'b'], 'OR'),
    ).toThrow(ForbiddenException);
  });

  it('normalizes legacy colon permission codes', () => {
    expect(() =>
      service.assertPermissions(
        snapshot(['roles:read']),
        ['roles.read'],
        'AND',
      ),
    ).not.toThrow();
  });

  it('allows a scoped manage permission to satisfy its CRUD permissions', () => {
    const admin = snapshot([
      'roles.manage',
      'permissions.manage',
      'users.manage',
    ]);

    expect(() =>
      service.assertPermissions(
        admin,
        ['roles.create', 'roles.read', 'roles.update', 'roles.delete'],
        'AND',
      ),
    ).not.toThrow();
    expect(() =>
      service.assertPermissions(
        admin,
        ['permissions.create', 'permissions.read'],
        'AND',
      ),
    ).not.toThrow();
    expect(() =>
      service.assertPermissions(admin, ['users.create'], 'AND'),
    ).not.toThrow();
  });

  it('does not let a scoped manage permission satisfy another domain', () => {
    expect(() =>
      service.assertPermissions(
        snapshot(['roles.manage']),
        ['permissions.create'],
        'AND',
      ),
    ).toThrow(ForbiddenException);
  });

  it('supports role AND and OR semantics', () => {
    expect(() =>
      service.assertRoles(
        snapshot([], ['admin', 'auditor']),
        ['admin', 'auditor'],
        'AND',
      ),
    ).not.toThrow();
    expect(() =>
      service.assertRoles(snapshot([], ['admin']), ['admin', 'auditor'], 'OR'),
    ).not.toThrow();
    expect(() =>
      service.assertRoles(snapshot([], ['user']), ['admin', 'auditor'], 'OR'),
    ).toThrow(ForbiddenException);
  });

  it('rejects empty or invalid policy metadata', () => {
    expect(() => service.assertPermissions(snapshot(['a']), [], 'AND')).toThrow(
      ForbiddenException,
    );
    expect(() =>
      service.assertPermissions(snapshot(['a']), [''], 'OR'),
    ).toThrow(ForbiddenException);
  });
});

describe('AuthorizationGuard', () => {
  const resolve = vi.fn();
  const assertPermissions = vi.fn();
  const assertRoles = vi.fn();
  const authorization = {
    resolve,
    assertPermissions,
    assertRoles,
  } as unknown as AuthorizationService;
  const reflector = new Reflector();
  const guard = new AuthorizationGuard(reflector, authorization);

  const request = (user?: { sub?: string; permissions?: string[] }) => ({
    user,
  });
  const context = (req: ReturnType<typeof request>, handler: object) =>
    ({
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => req }),
    }) as never;

  it('denies routes without authorization metadata', async () => {
    await expect(
      guard.canActivate(context(request({ sub: 'u' }), {})),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows only explicitly public routes', async () => {
    const handler = {};
    Reflect.defineMetadata('authorization:public', true, handler);
    await expect(guard.canActivate(context(request(), handler))).resolves.toBe(
      true,
    );
  });

  it('returns 401 when protected route has no authenticated identity', async () => {
    const handler = {};
    Reflect.defineMetadata(
      AUTHORIZATION_PERMISSIONS_METADATA,
      { values: ['users:read'], match: 'AND' },
      handler,
    );
    await expect(
      guard.canActivate(context(request(), handler)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('resolves authoritative permissions and ignores spoofed request permissions', async () => {
    const handler = {};
    Reflect.defineMetadata(
      AUTHORIZATION_PERMISSIONS_METADATA,
      { values: ['users:read'], match: 'AND' },
      handler,
    );
    resolve.mockResolvedValue(snapshot(['users:read'], ['user']));
    const req = request({
      sub: '7e9d9c67-30a5-4d2c-a8df-70755f96ad35',
      permissions: ['admin:all'],
    });
    await expect(guard.canActivate(context(req, handler))).resolves.toBe(true);
    expect(req.user?.permissions).toEqual(['users:read']);
  });

  it('ignores spoofed userId from request input because identity comes from principal', async () => {
    const handler = {};
    Reflect.defineMetadata(
      AUTHORIZATION_PERMISSIONS_METADATA,
      { values: ['users:read'], match: 'AND' },
      handler,
    );
    resolve.mockResolvedValue(snapshot(['users:read'], ['user']));
    const req = request({
      sub: '7e9d9c67-30a5-4d2c-a8df-70755f96ad35',
      permissions: ['admin:all'],
    }) as ReturnType<typeof request> & { body?: { userId: string } };
    req.body = { userId: 'spoofed-user' };

    await expect(guard.canActivate(context(req, handler))).resolves.toBe(true);
    expect(resolve).toHaveBeenCalledWith(req.user?.sub);
  });

  it('supports explicit role decorators and OR permission decorators', () => {
    expect(() => RequireRoles('admin')).not.toThrow();
    expect(() => RequireRolesAny('admin', 'auditor')).not.toThrow();
    expect(() =>
      RequirePermissionsAny('users:read', 'users:admin'),
    ).not.toThrow();
    expect(() => RequirePermissions('users:read')).not.toThrow();
    expect(Public).toBeTypeOf('function');
  });

  it('fails closed when resolution fails', async () => {
    const handler = {};
    Reflect.defineMetadata(
      AUTHORIZATION_PERMISSIONS_METADATA,
      { values: ['users:read'], match: 'AND' },
      handler,
    );
    resolve.mockRejectedValue(new Error('database unavailable'));
    await expect(
      guard.canActivate(context(request({ sub: 'u' }), handler)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies unknown permission requirements', async () => {
    const handler = {};
    Reflect.defineMetadata(
      AUTHORIZATION_PERMISSIONS_METADATA,
      { values: ['unknown:permission'], match: 'AND' },
      handler,
    );
    resolve.mockResolvedValue(snapshot(['users:read'], ['user']));
    assertPermissions.mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      guard.canActivate(context(request({ sub: 'u' }), handler)),
    ).rejects.toThrow(ForbiddenException);
  });
});
