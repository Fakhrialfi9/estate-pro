import { randomUUID } from 'node:crypto';

import type { SeedTransaction } from '../database.ts';
import { ROLES } from './data.ts';

export async function seedRoles(client: SeedTransaction): Promise<Map<string, bigint>> {
  const roleIds = new Map<string, bigint>();

  for (const role of ROLES) {
    const record = await client.authorizationRole.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isActive: true,
      },
      create: {
        uuid: randomUUID(),
        name: role.name,
        code: role.code,
        description: role.description,
        isActive: true,
      },
    });

    roleIds.set(role.code, record.id);
  }

  return roleIds;
}

export async function seedRolePermissions(
  client: SeedTransaction,
  roleIds: Map<string, bigint>,
  permissionIds: Map<string, bigint>,
  permissionCodes: readonly string[],
): Promise<void> {
  const adminRoleId = roleIds.get('ADMIN');
  if (adminRoleId === undefined) {
    throw new Error('Missing seeded ADMIN role');
  }

  for (const permissionCode of permissionCodes) {
    const permissionId = permissionIds.get(permissionCode);
    if (permissionId === undefined) {
      throw new Error(`Missing seeded permission: ${permissionCode}`);
    }

    await client.authorizationRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRoleId,
          permissionId,
        },
      },
      update: {},
      create: {
        roleId: adminRoleId,
        permissionId,
      },
    });
  }
}
