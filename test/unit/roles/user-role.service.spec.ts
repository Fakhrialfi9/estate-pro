import { describe, expect, it, vi } from 'vitest';
import { UserRoleService } from '../../../src/modules/roles/application/services/user-role.service.js';
import { RoleAuthorizationPolicy } from '../../../src/modules/roles/application/policies/role-authorization.policy.js';
import { RoleEntity } from '../../../src/modules/roles/domain/entities/role.entity.js';
import {
  UserRoleAlreadyExistsException,
  UserRoleNotFoundException,
  UserTargetNotFoundException,
  InvalidUserRoleIdentifierException,
  PrivilegedRoleAssignmentForbiddenException,
} from '../../../src/modules/roles/domain/errors/user-role.errors.js';

const actor = (permissions: string[]) => ({
  userUuid: '11111111-1111-4111-8111-111111111111',
  permissions,
});

const role = (code = 'manager', isSystem = false) =>
  RoleEntity.create({
    uuid: '22222222-2222-4222-8222-222222222222',
    name: code,
    code,
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    isSystem,
  });

const user = {
  uuid: '33333333-3333-4333-8333-333333333333',
};

const assignment = {
  userUuid: user.uuid,
  roleUuid: role().uuid,
  roleName: role().name,
  roleCode: role().code,
  roleIsSystem: false,
  isActive: true,
  assignedByUuid: actor(['roles:manage']).userUuid,
  assignedAt: new Date(),
  revokedAt: null,
};

describe('UserRoleService', () => {
  const make = () => {
    const users = { findByUuid: vi.fn() };
    const roles = { findByUuid: vi.fn() };
    const userRoles = {
      findByUserAndRole: vi.fn(),
      assign: vi.fn(),
      remove: vi.fn(),
      listByUser: vi.fn(),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new UserRoleService(
      users as never,
      roles as never,
      userRoles as never,
      audit as never,
      new RoleAuthorizationPolicy(),
    );
    return { service, users, roles, userRoles, audit };
  };

  it('rejects a regular user from assigning a role', async () => {
    const { service } = make();
    await expect(
      service.assign(actor([]), user.uuid, role().uuid, {}),
    ).rejects.toThrow();
  });

  it('rejects a regular user from removing a role', async () => {
    const { service } = make();
    await expect(
      service.remove(actor([]), user.uuid, role().uuid, {}),
    ).rejects.toThrow();
  });

  it('rejects protected-role assignment without protected permission', async () => {
    const { service, users, roles } = make();
    const protectedRole = role('admin', true);
    users.findByUuid.mockResolvedValue(user);
    roles.findByUuid.mockResolvedValue(protectedRole);

    await expect(
      service.assign(
        actor(['roles:manage']),
        user.uuid,
        protectedRole.uuid,
        {},
      ),
    ).rejects.toBeInstanceOf(PrivilegedRoleAssignmentForbiddenException);
  });

  it('assigns an existing role and creates a success audit event', async () => {
    const { service, users, roles, userRoles, audit } = make();
    const selectedRole = role();
    users.findByUuid.mockResolvedValue(user);
    roles.findByUuid.mockResolvedValue(selectedRole);
    userRoles.findByUserAndRole.mockResolvedValue(null);
    userRoles.assign.mockResolvedValue(assignment);

    const result = await service.assign(
      actor(['roles:manage']),
      user.uuid,
      selectedRole.uuid,
      { requestId: 'req-1' },
    );

    expect(result.userUuid).toBe(user.uuid);
    expect(userRoles.assign).toHaveBeenCalledOnce();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_ROLE_ASSIGNED' }),
    );
  });

  it('rejects duplicate active assignment without creating an audit event', async () => {
    const { service, users, roles, userRoles, audit } = make();
    const selectedRole = role();
    users.findByUuid.mockResolvedValue(user);
    roles.findByUuid.mockResolvedValue(selectedRole);
    userRoles.findByUserAndRole.mockResolvedValue(assignment);

    await expect(
      service.assign(actor(['roles:manage']), user.uuid, selectedRole.uuid, {}),
    ).rejects.toBeInstanceOf(UserRoleAlreadyExistsException);
    expect(userRoles.assign).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('maps concurrent database duplicate protection to a business error', async () => {
    const { service, users, roles, userRoles, audit } = make();
    const selectedRole = role();
    users.findByUuid.mockResolvedValue(user);
    roles.findByUuid.mockResolvedValue(selectedRole);
    userRoles.findByUserAndRole.mockResolvedValue(null);
    userRoles.assign.mockRejectedValue(new Error('UserRoleAlreadyExistsError'));

    await expect(
      service.assign(actor(['roles:manage']), user.uuid, selectedRole.uuid, {}),
    ).rejects.toBeInstanceOf(UserRoleAlreadyExistsException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent user before persistence', async () => {
    const { service, users, userRoles } = make();
    users.findByUuid.mockResolvedValue(null);

    await expect(
      service.assign(actor(['roles:manage']), user.uuid, role().uuid, {}),
    ).rejects.toBeInstanceOf(UserTargetNotFoundException);
    expect(userRoles.assign).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent role before persistence', async () => {
    const { service, users, roles, userRoles } = make();
    users.findByUuid.mockResolvedValue(user);
    roles.findByUuid.mockResolvedValue(null);

    await expect(
      service.assign(actor(['roles:manage']), user.uuid, role().uuid, {}),
    ).rejects.toThrow('Role not found');
    expect(userRoles.assign).not.toHaveBeenCalled();
  });

  it('rejects an invalid identifier', async () => {
    const { service } = make();
    await expect(
      service.assign(actor(['roles:manage']), 'not-a-uuid', role().uuid, {}),
    ).rejects.toBeInstanceOf(InvalidUserRoleIdentifierException);
  });

  it('removes an active assignment without deleting the user or role and audits success', async () => {
    const { service, users, roles, userRoles, audit } = make();
    const selectedRole = role();
    users.findByUuid.mockResolvedValue(user);
    roles.findByUuid.mockResolvedValue(selectedRole);
    userRoles.findByUserAndRole.mockResolvedValue(assignment);
    userRoles.remove.mockResolvedValue({ ...assignment, isActive: false });

    await service.remove(
      actor(['roles:manage']),
      user.uuid,
      selectedRole.uuid,
      {},
    );

    expect(userRoles.remove).toHaveBeenCalledWith({
      userUuid: user.uuid,
      roleUuid: selectedRole.uuid,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_ROLE_REMOVED' }),
    );
  });

  it('rejects removal of a protected role without protected permission', async () => {
    const { service, users, roles } = make();
    const selectedRole = role('admin', true);
    users.findByUuid.mockResolvedValue(user);
    roles.findByUuid.mockResolvedValue(selectedRole);

    await expect(
      service.remove(
        actor(['roles:manage']),
        user.uuid,
        selectedRole.uuid,
        {},
      ),
    ).rejects.toThrow();
  });

  it('rejects removal when the active relationship does not exist', async () => {
    const { service, users, roles, userRoles } = make();
    const selectedRole = role();
    users.findByUuid.mockResolvedValue(user);
    roles.findByUuid.mockResolvedValue(selectedRole);
    userRoles.findByUserAndRole.mockResolvedValue(null);

    await expect(
      service.remove(
        actor(['roles:manage']),
        user.uuid,
        selectedRole.uuid,
        {},
      ),
    ).rejects.toBeInstanceOf(UserRoleNotFoundException);
    expect(userRoles.remove).not.toHaveBeenCalled();
  });

  it('requires read authorization for listing and returns safe role data', async () => {
    const { service, users, userRoles } = make();
    users.findByUuid.mockResolvedValue(user);
    userRoles.listByUser.mockResolvedValue({ items: [assignment], total: 1 });

    const result = await service.list(
      actor(['roles:read']),
      user.uuid,
      { page: 1, limit: 20 },
    );

    expect(result).toEqual({
      user: { uuid: user.uuid },
      roles: [
        {
          uuid: assignment.roleUuid,
          name: assignment.roleName,
          code: assignment.roleCode,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect((result as unknown as { roles: unknown[] }).roles[0]).not.toHaveProperty('assignedByUuid');
  });
});
