import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { PermissionService } from '../../src/modules/permissions/application/services/permission.service.js';
import {
  InvalidPermissionException,
  PermissionAlreadyExistsException,
  PermissionInUseException,
  PermissionNotFoundException,
  PermissionResourceActionAlreadyExistsException,
  SystemPermissionProtectedException,
} from '../../src/modules/permissions/domain/errors/permission.errors.js';
import {
  buildPermissionCode,
  isProtectedPermissionCode,
  normalizePermissionName,
  normalizePermissionSegment,
  PermissionEntity,
} from '../../src/modules/permissions/domain/entities/permission.entity.js';
import {
  PermissionManageAccessGuard,
  PermissionReadAccessGuard,
} from '../../src/modules/permissions/security/permission-management-access.guard.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const context = {
  ipAddress: '127.0.0.1',
  requestId: 'req-1',
  userAgent: 'test',
};

const makePermission = (overrides: Record<string, unknown> = {}) =>
  PermissionEntity.create({
    uuid,
    name: 'Read Properties',
    code: 'properties.read',
    module: 'property',
    domain: 'properties',
    action: 'read',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

const ctx = (request: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
  }) as unknown as ExecutionContext;

describe('permission entity and service coverage', () => {
  it('covers permission normalization, protected codes and entity validation', () => {
    expect(normalizePermissionSegment('  TEST.Module  ')).toBe('test.module');
    expect(normalizePermissionName('  Read   Properties  ')).toBe(
      'Read Properties',
    );
    expect(buildPermissionCode('roles', 'manage', 'protected')).toBe(
      'roles.manage.protected',
    );
    expect(buildPermissionCode('property', 'properties', 'read')).toBe(
      'properties.read',
    );
    expect(isProtectedPermissionCode('roles.manage.protected')).toBe(true);
    expect(isProtectedPermissionCode('properties.read')).toBe(false);
    const permission = makePermission();
    expect(permission.resource).toBe('property:properties');
    expect(permission.isSystem).toBe(false);
    permission.update({ name: ' Updated Name ' });
    expect(permission.name).toBe('Updated Name');
    expect(() => makePermission({ uuid: 'bad' })).toThrow(
      'Invalid permission UUID',
    );
    expect(() => makePermission({ name: '' })).toThrow(
      'Invalid permission name',
    );
    expect(() => makePermission({ module: 'bad module' })).toThrow(
      'Invalid permission module',
    );
    expect(() => makePermission({ domain: 'bad domain' })).toThrow(
      'Invalid permission domain',
    );
    expect(() => makePermission({ action: 'bad action' })).toThrow(
      'Invalid permission action',
    );
    expect(() => makePermission({ code: 'other.code' })).toThrow(
      'Invalid permission identifier',
    );
  });

  it('covers permission create/get/list/update/delete paths including repository errors', async () => {
    const repository = {
      findByResourceAction: vi.fn().mockResolvedValue(null),
      findByCode: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(makePermission()),
      findByUuid: vi.fn().mockResolvedValue(makePermission()),
      list: vi.fn().mockResolvedValue({
        items: [makePermission()],
        total: 1,
      }),
      update: vi.fn().mockResolvedValue(makePermission({ name: 'Updated' })),
      getDependencyCount: vi.fn().mockResolvedValue({ roleAssignments: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const policy = {
      canRead: vi.fn(),
      canManage: vi.fn(),
      canManageProtected: vi.fn(),
    };
    const service = new PermissionService(
      repository as never,
      audit as never,
      policy as never,
    );
    const actor = {
      userUuid: uuid,
      permissions: ['permissions:manage'],
      roles: [],
    };

    await expect(
      service.create(
        actor as never,
        {
          name: 'Read Properties',
          module: 'property',
          domain: 'properties',
          action: 'read',
        },
        context,
      ),
    ).resolves.toBeInstanceOf(PermissionEntity);
    repository.findByResourceAction.mockResolvedValueOnce(makePermission());
    await expect(
      service.create(
        actor as never,
        {
          name: 'Read Properties',
          module: 'property',
          domain: 'properties',
          action: 'read',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(PermissionResourceActionAlreadyExistsException);
    repository.findByResourceAction.mockResolvedValueOnce(null);
    repository.findByCode.mockResolvedValueOnce(makePermission());
    await expect(
      service.create(
        actor as never,
        {
          name: 'Read Properties',
          module: 'property',
          domain: 'properties',
          action: 'read',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(PermissionAlreadyExistsException);
    repository.findByCode.mockResolvedValueOnce(null);
    repository.create.mockRejectedValueOnce(
      new Error('PermissionAlreadyExistsError'),
    );
    await expect(
      service.create(
        actor as never,
        {
          name: 'Read Properties',
          module: 'property',
          domain: 'properties',
          action: 'read',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(PermissionAlreadyExistsException);
    await expect(service.get(actor as never, uuid)).resolves.toBeInstanceOf(
      PermissionEntity,
    );
    repository.findByUuid.mockResolvedValueOnce(null);
    await expect(service.get(actor as never, uuid)).rejects.toBeInstanceOf(
      PermissionNotFoundException,
    );
    await expect(
      service.list(actor as never, { page: 1, limit: 10 }),
    ).resolves.toMatchObject({ total: 1 });

    await expect(
      service.update(actor as never, uuid, { name: 'New Name' }, context),
    ).resolves.toBeInstanceOf(PermissionEntity);
    repository.findByUuid.mockResolvedValueOnce(null);
    await expect(
      service.update(actor as never, uuid, { name: 'New Name' }, context),
    ).rejects.toBeInstanceOf(PermissionNotFoundException);
    repository.findByUuid.mockResolvedValueOnce(
      makePermission({
        code: 'roles.manage.protected',
        domain: 'manage',
        action: 'protected',
        module: 'roles',
        name: 'Protected',
      }),
    );
    policy.canManageProtected.mockImplementationOnce(() => {
      throw new SystemPermissionProtectedException();
    });
    await expect(
      service.update(actor as never, uuid, { name: 'Nope' }, context),
    ).rejects.toBeInstanceOf(SystemPermissionProtectedException);

    repository.findByUuid.mockResolvedValueOnce(makePermission());
    repository.getDependencyCount.mockResolvedValueOnce({ roleAssignments: 1 });
    await expect(
      service.delete(actor as never, uuid, context),
    ).rejects.toBeInstanceOf(PermissionInUseException);
    repository.findByUuid.mockResolvedValueOnce(makePermission());
    repository.getDependencyCount.mockResolvedValueOnce({ roleAssignments: 0 });
    repository.delete.mockRejectedValueOnce(
      Object.assign(new Error('foreign key'), { code: 'P2003' }),
    );
    await expect(
      service.delete(actor as never, uuid, context),
    ).rejects.toBeInstanceOf(PermissionInUseException);
    repository.delete.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'P2025' }),
    );
    await expect(
      service.delete(actor as never, uuid, context),
    ).rejects.toBeInstanceOf(PermissionNotFoundException);
    repository.delete.mockResolvedValueOnce(undefined);
    await expect(
      service.delete(actor as never, uuid, context),
    ).resolves.toBeUndefined();
    expect(audit.record).toHaveBeenCalled();

    expect(() => service['validateUuid']('not-uuid')).toThrow(
      InvalidPermissionException,
    );
  });
});

describe('permission access guard coverage', () => {
  const snapshot = {
    userUuid: uuid,
    permissionCodes: ['permissions.read'],
  };

  it('covers unauthenticated, missing snapshot and allowed/denied branches', async () => {
    const repository = {
      getAuthorizationSnapshot: vi.fn().mockResolvedValue(snapshot),
    };
    const read = new PermissionReadAccessGuard(repository as never);
    const manage = new PermissionManageAccessGuard(repository as never);

    await expect(
      read.canActivate(ctx({ user: undefined })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    repository.getAuthorizationSnapshot.mockResolvedValueOnce(null);
    await expect(
      read.canActivate(ctx({ user: { sub: uuid } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      read.canActivate(ctx({ user: { sub: uuid } })),
    ).resolves.toBe(true);
    repository.getAuthorizationSnapshot.mockResolvedValueOnce({
      userUuid: uuid,
      permissionCodes: [],
    });
    await expect(
      read.canActivate(ctx({ user: { sub: uuid } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    repository.getAuthorizationSnapshot.mockResolvedValueOnce({
      userUuid: uuid,
      permissionCodes: ['permissions.manage'],
    });
    await expect(
      read.canActivate(ctx({ user: { sub: uuid } })),
    ).resolves.toBe(true);
    repository.getAuthorizationSnapshot.mockResolvedValueOnce({
      userUuid: uuid,
      permissionCodes: ['other'],
    });
    await expect(
      manage.canActivate(ctx({ user: { sub: uuid } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    repository.getAuthorizationSnapshot.mockResolvedValueOnce({
      userUuid: uuid,
      permissionCodes: ['permissions.manage'],
    });
    await expect(
      manage.canActivate(ctx({ user: { sub: uuid } })),
    ).resolves.toBe(true);
  });
});
