import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PermissionService } from '../../../src/modules/permissions/application/services/permission.service.js';
import {
  PermissionAuthorizationPolicy,
  type PermissionActor,
} from '../../../src/modules/permissions/application/policies/permission-authorization.policy.js';
import { PermissionEntity } from '../../../src/modules/permissions/domain/entities/permission.entity.js';
import {
  PermissionAlreadyExistsException,
  PermissionInUseException,
  PermissionNotFoundException,
  PermissionResourceActionAlreadyExistsException,
  SystemPermissionProtectedException,
} from '../../../src/modules/permissions/domain/errors/permission.errors.js';

const actor = (permissions: string[]): PermissionActor => ({
  userUuid: 'd7bd8c39-3e51-4a03-953d-5f42c9ea1ab5',
  permissions,
});

const permission = (
  overrides: Partial<Parameters<typeof PermissionEntity.create>[0]> = {},
) =>
  PermissionEntity.create({
    uuid: '4f7d2c31-6f40-4fa8-9b79-1c99d9af1f12',
    name: 'Read Users',
    code: 'users.read',
    module: 'users',
    domain: 'users',
    action: 'read',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('PermissionService', () => {
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const repository = {
    create: vi.fn().mockResolvedValue(permission()),
    findByUuid: vi.fn().mockResolvedValue(permission()),
    findByCode: vi.fn().mockResolvedValue(null),
    findByResourceAction: vi.fn().mockResolvedValue(null),
    list: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    update: vi.fn().mockResolvedValue(permission({ name: 'Users Read' })),
    delete: vi.fn().mockResolvedValue(undefined),
    getDependencyCount: vi.fn().mockResolvedValue({ roleAssignments: 0 }),
  };

  const service = new PermissionService(
    repository as never,
    audit as never,
    new PermissionAuthorizationPolicy(),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findByUuid.mockResolvedValue(permission());
    repository.findByCode.mockResolvedValue(null);
    repository.findByResourceAction.mockResolvedValue(null);
    repository.getDependencyCount.mockResolvedValue({ roleAssignments: 0 });
    repository.create.mockResolvedValue(permission());
    repository.update.mockResolvedValue(permission({ name: 'Users Read' }));
    repository.delete.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
  });

  it('creates a normalized permission with the canonical module.action identifier', async () => {
    const result = await service.create(
      actor(['permissions.manage']),
      {
        name: ' Read Users ',
        module: ' USERS ',
        domain: ' Users ',
        action: ' READ ',
      },
      {},
    );

    expect(result.code).toBe('users.read');
    expect(repository.create).toHaveBeenCalledWith({
      name: 'Read Users',
      module: 'users',
      domain: 'users',
      action: 'read',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERMISSION_CREATED' }),
    );
  });

  it('rejects regular users from permission management', async () => {
    await expect(
      service.create(
        actor([]),
        {
          name: 'Read Users',
          module: 'users',
          domain: 'users',
          action: 'read',
        },
        {},
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_PERMISSION_OPERATION' });

    await expect(
      service.update(actor([]), permission().uuid, { name: 'x' }, {}),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_PERMISSION_OPERATION' });
    await expect(
      service.delete(actor([]), permission().uuid, {}),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_PERMISSION_OPERATION' });
  });

  it('rejects duplicate semantic identities before persistence', async () => {
    repository.findByResourceAction.mockResolvedValueOnce(permission());
    await expect(
      service.create(
        actor(['permissions.manage']),
        {
          name: 'Read Users',
          module: 'users',
          domain: 'users',
          action: 'read',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(PermissionResourceActionAlreadyExistsException);

    repository.findByResourceAction.mockResolvedValue(null);
    repository.findByCode.mockResolvedValueOnce(permission());
    await expect(
      service.create(
        actor(['permissions.manage']),
        {
          name: 'Read Users',
          module: 'users',
          domain: 'users',
          action: 'read',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(PermissionAlreadyExistsException);
  });

  it('maps a concurrent database unique violation to a business error', async () => {
    repository.create.mockRejectedValueOnce(
      new Error('PermissionAlreadyExistsError'),
    );
    await expect(
      service.create(
        actor(['permissions.manage']),
        {
          name: 'Read Users',
          module: 'users',
          domain: 'users',
          action: 'read',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(PermissionAlreadyExistsException);
  });

  it('reads existing permission and rejects missing permission', async () => {
    await expect(
      service.get(actor(['permissions.read']), permission().uuid),
    ).resolves.toBeInstanceOf(PermissionEntity);

    repository.findByUuid.mockResolvedValueOnce(null);
    await expect(
      service.get(actor(['permissions.read']), permission().uuid),
    ).rejects.toBeInstanceOf(PermissionNotFoundException);
  });

  it('lists through the repository abstraction', async () => {
    const query = {
      page: 1,
      limit: 20,
      filterField: 'module' as const,
      filterValue: 'users',
      sortBy: 'createdAt' as const,
      sortDirection: 'desc' as const,
    };
    await service.list(actor(['permissions.read']), query);
    expect(repository.list).toHaveBeenCalledWith(query);
  });

  it('updates only the display name and audits it', async () => {
    const result = await service.update(
      actor(['permissions.manage']),
      permission().uuid,
      { name: 'Users Read' },
      {},
    );
    expect(result.code).toBe('users.read');
    expect(repository.update).toHaveBeenCalledWith(permission().uuid, {
      name: 'Users Read',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERMISSION_UPDATED' }),
    );
  });

  it('protects critical permissions from regular management', async () => {
    repository.findByUuid.mockResolvedValueOnce(
      permission({
        code: 'permissions.manage.protected',
        module: 'permissions',
        domain: 'manage',
        action: 'protected',
      }),
    );

    await expect(
      service.update(
        actor(['permissions.manage']),
        permission().uuid,
        { name: 'x' },
        {},
      ),
    ).rejects.toBeInstanceOf(SystemPermissionProtectedException);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SYSTEM_PERMISSION_UPDATE_ATTEMPTED' }),
    );
  });

  it('deletes an unused permission and audits it', async () => {
    await service.delete(actor(['permissions.manage']), permission().uuid, {});
    expect(repository.delete).toHaveBeenCalledWith(permission().uuid);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERMISSION_DELETED' }),
    );
  });

  it('blocks deletion when a role still references the permission', async () => {
    repository.getDependencyCount.mockResolvedValueOnce({ roleAssignments: 1 });
    await expect(
      service.delete(actor(['permissions.manage']), permission().uuid, {}),
    ).rejects.toBeInstanceOf(PermissionInUseException);
    expect(repository.delete).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERMISSION_DELETE_BLOCKED' }),
    );
  });

  it('rejects invalid identifiers rather than leaking persistence details', async () => {
    await expect(
      service.get(actor(['permissions.read']), 'not-a-uuid'),
    ).rejects.toMatchObject({ code: 'INVALID_PERMISSION_IDENTIFIER' });
  });
});
