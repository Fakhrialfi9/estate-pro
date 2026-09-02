import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolePermissionService } from '../../../src/modules/roles/application/services/role-permission.service.js';
import { RoleAuthorizationPolicy } from '../../../src/modules/roles/application/policies/role-authorization.policy.js';
import { PermissionAuthorizationPolicy } from '../../../src/modules/permissions/application/policies/permission-authorization.policy.js';
import { RoleEntity } from '../../../src/modules/roles/domain/entities/role.entity.js';
import { PermissionEntity } from '../../../src/modules/permissions/domain/entities/permission.entity.js';

const roleUuid = '4f7d2c31-6f40-4fa8-9b79-1c99d9af1f12';
const permissionUuid = '8f7d2c31-6f40-4fa8-9b79-1c99d9af1f13';
const actor = (permissions: string[]) => ({
  userUuid: 'd7bd8c39-3e51-4a03-953d-5f42c9ea1ab5',
  permissions,
});

const role = RoleEntity.create({
  uuid: roleUuid,
  name: 'Sales',
  code: 'sales',
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  isSystem: false,
});

const permission = PermissionEntity.create({
  uuid: permissionUuid,
  name: 'Read Listings',
  code: 'listings.read',
  module: 'listings',
  domain: 'listings',
  action: 'read',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('RolePermissionService', () => {
  const assignments = {
    exists: vi.fn().mockResolvedValue(false),
    assign: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    listByRole: vi.fn().mockResolvedValue({
      items: [permission.toSnapshot()],
      total: 1,
      page: 1,
      limit: 20,
    }),
  };
  const roles = { findByUuid: vi.fn().mockResolvedValue(role) };
  const permissions = { findByUuid: vi.fn().mockResolvedValue(permission) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  const service = new RolePermissionService(
    assignments,
    roles as never,
    permissions as never,
    audit,
    new RoleAuthorizationPolicy(),
    new PermissionAuthorizationPolicy(),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    assignments.exists.mockResolvedValue(false);
    assignments.assign.mockResolvedValue(undefined);
    assignments.remove.mockResolvedValue(undefined);
    assignments.listByRole.mockResolvedValue({
      items: [permission.toSnapshot()],
      total: 1,
      page: 1,
      limit: 20,
    });
    roles.findByUuid.mockResolvedValue(role);
    permissions.findByUuid.mockResolvedValue(permission);
    audit.record.mockResolvedValue(undefined);
  });

  it('assigns an existing permission to an existing role and audits success', async () => {
    const result = await service.assign(
      actor(['roles.manage']),
      roleUuid,
      permissionUuid,
      {},
    );
    expect(result.role.uuid).toBe(roleUuid);
    expect(result.permission.uuid).toBe(permissionUuid);
    expect(assignments.assign).toHaveBeenCalledWith(roleUuid, permissionUuid);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_PERMISSION_ASSIGNED' }),
    );
  });

  it('rejects regular users from assignment', async () => {
    await expect(
      service.assign(actor([]), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'ROLE_PERMISSION_ASSIGNMENT_FORBIDDEN' });
    expect(assignments.assign).not.toHaveBeenCalled();
  });

  it('rejects regular users from removal', async () => {
    await expect(
      service.remove(actor([]), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'ROLE_PERMISSION_REMOVAL_FORBIDDEN' });
    expect(assignments.remove).not.toHaveBeenCalled();
  });

  it('rejects invalid role identifiers', async () => {
    await expect(
      service.assign(actor(['roles.manage']), 'not-a-uuid', permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'INVALID_ROLE_IDENTIFIER' });
  });

  it('rejects invalid permission identifiers', async () => {
    await expect(
      service.assign(actor(['roles.manage']), roleUuid, 'not-a-uuid', {}),
    ).rejects.toMatchObject({ code: 'INVALID_PERMISSION_IDENTIFIER' });
  });

  it('rejects nonexistent roles', async () => {
    roles.findByUuid.mockResolvedValueOnce(null);
    await expect(
      service.assign(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
  });

  it('rejects nonexistent permissions', async () => {
    permissions.findByUuid.mockResolvedValueOnce(null);
    await expect(
      service.assign(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'PERMISSION_NOT_FOUND' });
  });

  it('rejects duplicate assignment before persistence', async () => {
    assignments.exists.mockResolvedValueOnce(true);
    await expect(
      service.assign(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'ROLE_PERMISSION_ALREADY_EXISTS' });
    expect(assignments.assign).not.toHaveBeenCalled();
  });

  it('maps a database race duplicate to a business error', async () => {
    assignments.assign.mockRejectedValueOnce(
      new Error('RolePermissionAlreadyExistsError'),
    );
    await expect(
      service.assign(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'ROLE_PERMISSION_ALREADY_EXISTS' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('removes an existing assignment without deleting role or permission', async () => {
    assignments.exists.mockResolvedValueOnce(true);
    await service.remove(actor(['roles.manage']), roleUuid, permissionUuid, {});
    expect(assignments.remove).toHaveBeenCalledWith(roleUuid, permissionUuid);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_PERMISSION_REMOVED' }),
    );
  });

  it('rejects removal of a missing assignment', async () => {
    assignments.exists.mockResolvedValueOnce(false);
    await expect(
      service.remove(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'ROLE_PERMISSION_NOT_FOUND' });
    expect(assignments.remove).not.toHaveBeenCalled();
  });

  it('rejects protected-role removal without the protected-role permission', async () => {
    const protectedRole = RoleEntity.create({
      ...role.toSnapshot(),
      uuid: roleUuid,
      name: 'Admin',
      code: 'admin',
      isSystem: true,
    });
    roles.findByUuid.mockResolvedValueOnce(protectedRole);
    await expect(
      service.remove(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'SYSTEM_ROLE_PROTECTED' });
    expect(assignments.remove).not.toHaveBeenCalled();
  });

  it('lists assigned permissions through an explicit serialized read model', async () => {
    const result = await service.list(actor(['roles.read']), roleUuid, {
      page: 1,
      limit: 20,
    });
    expect(result.role.uuid).toBe(roleUuid);
    expect(result.assignments.items[0]?.code).toBe(permission.code);
    expect(result.assignments.items[0]).not.toHaveProperty('password');
  });

  it('rejects protected-role assignment without the protected-role permission', async () => {
    const protectedRole = RoleEntity.create({
      ...role.toSnapshot(),
      uuid: roleUuid,
      name: 'Admin',
      code: 'admin',
      isSystem: true,
    });
    roles.findByUuid.mockResolvedValueOnce(protectedRole);
    await expect(
      service.assign(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'SYSTEM_ROLE_PROTECTED' });
  });

  it('rejects protected permission management without the protected-permission permission', async () => {
    const protectedPermission = PermissionEntity.create({
      ...permission.toSnapshot(),
      name: 'Protected Role Management',
      code: 'roles.manage.protected',
      module: 'roles',
      domain: 'manage',
      action: 'protected',
    });
    permissions.findByUuid.mockResolvedValueOnce(protectedPermission);
    await expect(
      service.remove(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'SYSTEM_PERMISSION_PROTECTED' });
    expect(assignments.remove).not.toHaveBeenCalled();
  });

  it('rejects protected permission assignment without the protected-permission permission', async () => {
    const protectedPermission = PermissionEntity.create({
      ...permission.toSnapshot(),
      name: 'Protected Role Management',
      code: 'roles.manage.protected',
      module: 'roles',
      domain: 'manage',
      action: 'protected',
    });
    permissions.findByUuid.mockResolvedValueOnce(protectedPermission);
    await expect(
      service.assign(actor(['roles.manage']), roleUuid, permissionUuid, {}),
    ).rejects.toMatchObject({ code: 'SYSTEM_PERMISSION_PROTECTED' });
    expect(assignments.assign).not.toHaveBeenCalled();
  });
});
