import { describe, expect, it, vi } from 'vitest';
import { RoleService } from '../../../src/modules/roles/application/services/role.service.js';
import {
  RoleAuthorizationPolicy,
  type RoleActor,
} from '../../../src/modules/roles/application/policies/role-authorization.policy.js';
import { RoleEntity } from '../../../src/modules/roles/domain/entities/role.entity.js';
import {
  RoleAlreadyExistsException,
  RoleCodeAlreadyExistsException,
  RoleInUseException,
  SystemRoleProtectedException,
} from '../../../src/modules/roles/domain/errors/role.errors.js';

const actor = (permissions: string[]): RoleActor => ({
  userUuid: 'd7bd8c39-3e51-4a03-953d-5f42c9ea1ab5',
  permissions,
});
const role = (
  overrides: Partial<Parameters<typeof RoleEntity.create>[0]> = {},
) =>
  RoleEntity.create({
    uuid: '4f7d2c31-6f40-4fa8-9b79-1c99d9af1f12',
    name: 'Sales',
    code: 'sales',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    isSystem: false,
    ...overrides,
  });

describe('RoleService', () => {
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const repository = {
    create: vi.fn().mockResolvedValue(role()),
    findByUuid: vi.fn().mockResolvedValue(role()),
    findByCode: vi.fn().mockResolvedValue(null),
    findByName: vi.fn().mockResolvedValue(null),
    list: vi.fn(),
    update: vi.fn().mockResolvedValue(role({ name: 'Sales Updated' })),
    delete: vi.fn().mockResolvedValue(undefined),
    getDependencyCount: vi
      .fn()
      .mockResolvedValue({ userAssignments: 0, permissionAssignments: 0 }),
  };
  const service = new RoleService(
    repository,
    audit,
    new RoleAuthorizationPolicy(),
  );

  it('creates a role and audits it', async () => {
    const result = await service.create(
      actor(['roles:manage']),
      { name: 'Sales', code: 'sales' },
      {},
    );
    expect(result.code).toBe('sales');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_CREATED' }),
    );
  });

  it('rejects regular users from creating roles', async () => {
    await expect(
      service.create(actor([]), { name: 'Sales', code: 'sales' }, {}),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE_OPERATION' });
  });

  it('rejects duplicate name and code', async () => {
    repository.findByName.mockResolvedValueOnce(role());
    await expect(
      service.create(
        actor(['roles:manage']),
        { name: 'Sales', code: 'sales-2' },
        {},
      ),
    ).rejects.toBeInstanceOf(RoleAlreadyExistsException);
    repository.findByName.mockResolvedValue(null);
    repository.findByCode.mockResolvedValueOnce(role());
    await expect(
      service.create(
        actor(['roles:manage']),
        { name: 'Sales 2', code: 'sales' },
        {},
      ),
    ).rejects.toBeInstanceOf(RoleCodeAlreadyExistsException);
  });

  it('blocks deletion when dependencies exist', async () => {
    repository.getDependencyCount.mockResolvedValueOnce({
      userAssignments: 1,
      permissionAssignments: 0,
    });
    await expect(
      service.delete(actor(['roles:manage']), role().uuid, {}),
    ).rejects.toBeInstanceOf(RoleInUseException);
    expect(repository.delete).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_DELETE_BLOCKED' }),
    );
  });

  it('blocks protected-role deletion without protected permission', async () => {
    repository.findByUuid.mockResolvedValueOnce(
      role({ code: 'admin', name: 'Admin', isSystem: true }),
    );
    await expect(
      service.delete(actor(['roles:manage']), role().uuid, {}),
    ).rejects.toBeInstanceOf(SystemRoleProtectedException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('preserves stable identifier on update', async () => {
    const current = role({ code: 'sales' });
    repository.findByUuid.mockResolvedValueOnce(current);
    repository.update.mockResolvedValueOnce(
      role({ name: 'Sales Operations', code: 'sales' }),
    );
    const updated = await service.update(
      actor(['roles:manage']),
      current.uuid,
      { name: 'Sales Operations' },
      {},
    );
    expect(updated.code).toBe('sales');
    expect(repository.update).toHaveBeenCalledWith(current.uuid, {
      name: 'Sales Operations',
    });
  });
});
