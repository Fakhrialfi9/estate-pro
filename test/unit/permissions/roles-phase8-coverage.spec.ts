import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  PermissionReadAccessGuard,
  PermissionManageAccessGuard,
} from '../../../src/modules/permissions/security/permission-management-access.guard.js';
import {
  RoleReadAccessGuard,
  RoleManageAccessGuard,
} from '../../../src/modules/roles/security/role-management-access.guard.js';
import { PermissionService } from '../../../src/modules/permissions/application/services/permission.service.js';
import { RoleService } from '../../../src/modules/roles/application/services/role.service.js';
import { RolePermissionService } from '../../../src/modules/roles/application/services/role-permission.service.js';
import { UserRoleService } from '../../../src/modules/roles/application/services/user-role.service.js';
import { PermissionAuthorizationPolicy } from '../../../src/modules/permissions/application/policies/permission-authorization.policy.js';
import { RoleAuthorizationPolicy } from '../../../src/modules/roles/application/policies/role-authorization.policy.js';
import { PermissionEntity } from '../../../src/modules/permissions/domain/entities/permission.entity.js';
import { RoleEntity } from '../../../src/modules/roles/domain/entities/role.entity.js';
import { UserRoleEntity } from '../../../src/modules/roles/domain/entities/user-role.entity.js';
import * as roleErrors from '../../../src/modules/roles/domain/errors/role.errors.js';
import * as userRoleErrors from '../../../src/modules/roles/domain/errors/user-role.errors.js';
import type { ExecutionContext } from '@nestjs/common';
import type { PermissionRepository } from '../../../src/modules/permissions/domain/repositories/permission.repository.js';
import type { RoleRepository } from '../../../src/modules/roles/domain/repositories/role.repository.js';
import type { RolePermissionRepository } from '../../../src/modules/roles/domain/repositories/role-permission.repository.js';
import type { UserRoleRepository } from '../../../src/modules/roles/domain/repositories/user-role.repository.js';
import type { UserRoleTargetRepository } from '../../../src/modules/roles/domain/repositories/user-role-target.repository.js';

const userUuid = '11111111-1111-4111-8111-111111111111';
const roleUuid = '22222222-2222-4222-8222-222222222222';
const permissionUuid = '33333333-3333-4333-8333-333333333333';
const date = new Date('2026-01-01T00:00:00.000Z');
const context = {
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const role = (system = false): RoleEntity =>
  RoleEntity.create({
    uuid: roleUuid,
    name: system ? 'Admin' : 'Staff',
    code: system ? 'admin' : 'staff',
    description: null,
    isActive: true,
    createdAt: date,
    updatedAt: date,
    isSystem: system,
  });

const permission = (system = false): PermissionEntity =>
  PermissionEntity.create({
    uuid: permissionUuid,
    name: system ? 'Protected' : 'Read leads',
    code: system ? 'permissions.manage.protected' : 'leads.read',
    module: system ? 'permissions' : 'crm',
    domain: system ? 'manage' : 'leads',
    action: system ? 'protected' : 'read',
    createdAt: date,
    updatedAt: date,
  });

const userRole = (active = true): UserRoleEntity =>
  UserRoleEntity.create({
    userUuid,
    roleUuid,
    roleName: 'Staff',
    roleCode: 'staff',
    roleIsSystem: false,
    isActive: active,
    assignedByUuid: active ? userUuid : null,
    assignedAt: date,
    revokedAt: active ? null : date,
  });

const httpContext = (request: {
  user?: { sub: string; permissions?: string[] };
}): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('phase 8 permissions and roles', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('covers permission and role access guard authentication and permission matrices', async () => {
    const authorization = { getAuthorizationSnapshot: vi.fn() };
    await expect(
      new PermissionReadAccessGuard(authorization).canActivate(httpContext({})),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    authorization.getAuthorizationSnapshot.mockResolvedValueOnce(null);
    await expect(
      new PermissionReadAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    authorization.getAuthorizationSnapshot.mockResolvedValue({
      permissionCodes: ['permissions:read'],
    });
    const readRequest = { user: { sub: userUuid } };
    await expect(
      new PermissionReadAccessGuard(authorization).canActivate(
        httpContext(readRequest),
      ),
    ).resolves.toBe(true);
    expect(readRequest.user.permissions).toEqual(['permissions:read']);
    authorization.getAuthorizationSnapshot.mockResolvedValue({
      permissionCodes: ['permissions:manage'],
    });
    await expect(
      new PermissionReadAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).resolves.toBe(true);
    authorization.getAuthorizationSnapshot.mockResolvedValue({
      permissionCodes: ['other'],
    });
    await expect(
      new PermissionReadAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new PermissionManageAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    authorization.getAuthorizationSnapshot.mockResolvedValue({
      permissionCodes: ['permissions.manage'],
    });
    await expect(
      new PermissionManageAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).resolves.toBe(true);
    authorization.getAuthorizationSnapshot.mockResolvedValue({
      permissionCodes: ['roles:read'],
    });
    await expect(
      new RoleReadAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).resolves.toBe(true);
    authorization.getAuthorizationSnapshot.mockResolvedValue({
      permissionCodes: ['roles.manage'],
    });
    await expect(
      new RoleReadAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).resolves.toBe(true);
    authorization.getAuthorizationSnapshot.mockResolvedValue({
      permissionCodes: ['other'],
    });
    await expect(
      new RoleReadAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new RoleManageAccessGuard(authorization).canActivate(
        httpContext({ user: { sub: userUuid } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('covers permission service lifecycle, conflicts, protected paths and repository mapping', async () => {
    const repository = {
      findByResourceAction: vi.fn().mockResolvedValue(null),
      findByCode: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(permission()),
      findByUuid: vi.fn().mockResolvedValue(permission()),
      list: vi.fn().mockResolvedValue({ items: [permission()], total: 1 }),
      update: vi.fn().mockResolvedValue(permission()),
      delete: vi.fn().mockResolvedValue(undefined),
      getDependencyCount: vi.fn().mockResolvedValue({ roleAssignments: 0 }),
    } as unknown as PermissionRepository;
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const policy = {
      canManage: vi.fn(),
      canManageProtected: vi.fn(),
      canRead: vi.fn(),
    } as unknown as PermissionAuthorizationPolicy;
    const service = new PermissionService(repository, audit, policy);
    const actor = { userUuid, permissions: ['permissions.manage'] };
    await expect(
      service.create(
        actor,
        { name: 'Read leads', module: 'crm', domain: 'leads', action: 'read' },
        context,
      ),
    ).resolves.toBeInstanceOf(PermissionEntity);
    repository.findByResourceAction.mockResolvedValueOnce(permission());
    await expect(
      service.create(
        actor,
        { name: 'Read leads', module: 'crm', domain: 'leads', action: 'read' },
        context,
      ),
    ).rejects.toThrow('same resource and action');
    repository.findByResourceAction.mockResolvedValueOnce(null);
    repository.findByCode.mockResolvedValueOnce(permission());
    await expect(
      service.create(
        actor,
        { name: 'Read leads', module: 'crm', domain: 'leads', action: 'read' },
        context,
      ),
    ).rejects.toThrow('same identifier');
    repository.findByResourceAction.mockResolvedValueOnce(null);
    repository.findByCode.mockResolvedValueOnce(null);
    repository.create.mockRejectedValueOnce(
      new Error('PermissionAlreadyExistsError'),
    );
    await expect(
      service.create(
        actor,
        { name: 'Read leads', module: 'crm', domain: 'leads', action: 'read' },
        context,
      ),
    ).rejects.toThrow('already exists');
    await expect(service.get(actor, 'bad')).rejects.toThrow(
      'identifier is invalid',
    );
    repository.findByUuid.mockResolvedValueOnce(null);
    await expect(service.get(actor, permissionUuid)).rejects.toThrow(
      'Permission not found',
    );
    await expect(
      service.list(actor, { page: 1, limit: 10 }),
    ).resolves.toMatchObject({ total: 1 });
    repository.findByUuid.mockResolvedValue(permission());
    await expect(
      service.update(actor, permissionUuid, { name: ' Updated ' }, context),
    ).resolves.toBeInstanceOf(PermissionEntity);
    repository.findByUuid.mockResolvedValue(null);
    await expect(
      service.update(actor, permissionUuid, { name: 'Updated' }, context),
    ).rejects.toThrow('Permission not found');
    repository.findByUuid.mockResolvedValue(permission());
    repository.getDependencyCount.mockResolvedValue({ roleAssignments: 1 });
    await expect(
      service.delete(actor, permissionUuid, context),
    ).rejects.toThrow('still referenced');
    repository.getDependencyCount.mockResolvedValue({ roleAssignments: 0 });
    repository.delete.mockRejectedValueOnce({ code: 'P2003' });
    await expect(
      service.delete(actor, permissionUuid, context),
    ).rejects.toThrow('still referenced');
    repository.delete.mockRejectedValueOnce({ code: 'P2025' });
    await expect(
      service.delete(actor, permissionUuid, context),
    ).rejects.toThrow('Permission not found');
  });

  it('covers role permission and role service branches', async () => {
    const assignments = {
      exists: vi.fn().mockResolvedValue(false),
      assign: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      listByRole: vi.fn().mockResolvedValue([]),
    } as unknown as RolePermissionRepository;
    const roles = {
      findByUuid: vi.fn().mockResolvedValue(role()),
      findByName: vi.fn().mockResolvedValue(null),
      findByCode: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(role()),
      update: vi.fn().mockResolvedValue(role()),
      delete: vi.fn().mockResolvedValue(undefined),
      getDependencyCount: vi
        .fn()
        .mockResolvedValue({ userAssignments: 0, permissionAssignments: 0 }),
    } as unknown as RoleRepository;
    const permissions = {
      findByUuid: vi.fn().mockResolvedValue(permission()),
    } as unknown as PermissionRepository;
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const rolePolicy = {
      canRead: vi.fn(),
      canManage: vi.fn(),
      canModifyProtected: vi.fn(),
    } as unknown as RoleAuthorizationPolicy;
    const permissionPolicy = {
      canManageProtected: vi.fn(),
    } as unknown as PermissionAuthorizationPolicy;
    const actor = { userUuid, permissions: ['roles.update'] };
    const rpService = new RolePermissionService(
      assignments,
      roles,
      permissions,
      audit,
      rolePolicy,
      permissionPolicy,
    );
    await expect(
      rpService.assign(actor, roleUuid, permissionUuid, context),
    ).resolves.toMatchObject({ permission: { uuid: permissionUuid } });
    assignments.exists.mockResolvedValueOnce(true);
    await expect(
      rpService.assign(actor, roleUuid, permissionUuid, context),
    ).rejects.toThrow('already exists');
    assignments.exists.mockResolvedValueOnce(false);
    permissions.findByUuid.mockResolvedValueOnce(null);
    await expect(
      rpService.assign(actor, roleUuid, permissionUuid, context),
    ).rejects.toThrow('Permission not found');
    roles.findByUuid.mockResolvedValueOnce(null);
    await expect(
      rpService.assign(actor, roleUuid, permissionUuid, context),
    ).rejects.toThrow('Role not found');
    permissions.findByUuid.mockResolvedValue(permission());
    roles.findByUuid.mockResolvedValue(role());
    assignments.exists.mockResolvedValue(true);
    await expect(
      rpService.remove(actor, roleUuid, permissionUuid, context),
    ).resolves.toBeUndefined();
    assignments.exists.mockResolvedValue(false);
    await expect(
      rpService.remove(actor, roleUuid, permissionUuid, context),
    ).rejects.toThrow('assignment');
    await expect(
      rpService.list(actor, roleUuid, { page: 1, limit: 10 }),
    ).resolves.toMatchObject({ role: role() });

    const roleService = new RoleService(roles, audit, rolePolicy);
    roles.findByName.mockResolvedValue(null);
    roles.findByCode.mockResolvedValue(null);
    await expect(
      roleService.create(actor, { name: ' Staff ', code: 'staff' }, context),
    ).resolves.toBeInstanceOf(RoleEntity);
    roles.findByName.mockResolvedValue(role());
    await expect(
      roleService.create(actor, { name: 'Staff', code: 'staff' }, context),
    ).rejects.toThrow('same name');
    roles.findByName.mockResolvedValue(null);
    roles.findByCode.mockResolvedValue(role());
    await expect(
      roleService.create(actor, { name: 'Staff', code: 'staff' }, context),
    ).rejects.toThrow('same identifier');
    roles.findByUuid.mockResolvedValue(role());
    await expect(
      roleService.update(
        actor,
        roleUuid,
        { name: 'Manager', isActive: true },
        context,
      ),
    ).resolves.toBeInstanceOf(RoleEntity);
    roles.findByUuid.mockResolvedValue(role(true));
    await expect(
      roleService.update(actor, roleUuid, { isActive: false }, context),
    ).rejects.toThrow('not allowed');
    await expect(roleService.delete(actor, roleUuid, context)).rejects.toThrow(
      'not allowed',
    );
    roles.findByUuid.mockResolvedValue(role());
    roles.getDependencyCount.mockResolvedValue({
      userAssignments: 1,
      permissionAssignments: 0,
    });
    await expect(roleService.delete(actor, roleUuid, context)).rejects.toThrow(
      'still referenced',
    );
    roles.getDependencyCount.mockResolvedValue({
      userAssignments: 0,
      permissionAssignments: 0,
    });
    await roleService.delete(actor, roleUuid, context);
  });

  it('covers user role assignment, removal, list, and entity invariants', async () => {
    const users = {
      findByUuid: vi.fn().mockResolvedValue({ uuid: userUuid }),
    } as unknown as UserRoleTargetRepository;
    const roles = {
      findByUuid: vi.fn().mockResolvedValue(role()),
    } as unknown as RoleRepository;
    const userRoles = {
      findByUserAndRole: vi.fn().mockResolvedValue(null),
      assign: vi.fn().mockResolvedValue(userRole()),
      remove: vi.fn().mockResolvedValue(undefined),
      listByUser: vi.fn().mockResolvedValue({
        items: [{ roleUuid, roleName: 'Staff', roleCode: 'staff' }],
        total: 1,
      }),
    } as unknown as UserRoleRepository;
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const policy = {
      canManage: vi.fn(),
      canRead: vi.fn(),
    } as unknown as RoleAuthorizationPolicy;
    const service = new UserRoleService(users, roles, userRoles, audit, policy);
    const actor = { userUuid, permissions: ['roles.update'] };
    await expect(
      service.assign(actor, userUuid, roleUuid, context),
    ).resolves.toBeInstanceOf(UserRoleEntity);
    userRoles.findByUserAndRole.mockResolvedValueOnce(userRole());
    await expect(
      service.assign(actor, userUuid, roleUuid, context),
    ).rejects.toThrow('already exists');
    userRoles.findByUserAndRole.mockResolvedValueOnce(userRole());
    await expect(
      service.remove(actor, userUuid, roleUuid, context),
    ).resolves.toBeUndefined();
    userRoles.findByUserAndRole.mockResolvedValueOnce(null);
    await expect(
      service.remove(actor, userUuid, roleUuid, context),
    ).rejects.toThrow('assignment not found');
    await expect(
      service.list(actor, userUuid, { page: 1, limit: 10 }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      service.list(actor, 'bad', { page: 1, limit: 10 }),
    ).rejects.toThrow('identifier');
    users.findByUuid.mockResolvedValueOnce(null);
    await expect(
      service.assign(actor, userUuid, roleUuid, context),
    ).rejects.toThrow('Target user');
    expect(() =>
      UserRoleEntity.create({
        ...userRole(false).toSnapshot(),
        revokedAt: null,
      }),
    ).toThrow('revoked timestamp');
    expect(() =>
      UserRoleEntity.create({ ...userRole().toSnapshot(), revokedAt: date }),
    ).toThrow('cannot have a revoked timestamp');
    const errors = [
      roleErrors.RoleNotFoundException,
      roleErrors.RoleAlreadyExistsException,
      roleErrors.RoleCodeAlreadyExistsException,
      roleErrors.RoleInUseException,
      roleErrors.SystemRoleProtectedException,
      roleErrors.RoleUpdateNotAllowedException,
      roleErrors.RoleDeleteNotAllowedException,
      roleErrors.UnauthorizedRoleOperationException,
      roleErrors.ForbiddenRoleOperationException,
    ];
    for (const ErrorType of errors)
      expect(new ErrorType()).toBeInstanceOf(Error);
    const userErrors = [
      userRoleErrors.UserRoleAlreadyExistsException,
      userRoleErrors.UserRoleNotFoundException,
      userRoleErrors.UserTargetNotFoundException,
      userRoleErrors.PrivilegedRoleAssignmentForbiddenException,
      userRoleErrors.InvalidUserRoleIdentifierException,
    ];
    for (const ErrorType of userErrors)
      expect(new ErrorType()).toBeInstanceOf(Error);
  });
});
