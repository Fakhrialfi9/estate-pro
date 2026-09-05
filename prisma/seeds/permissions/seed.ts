import type { SeedTransaction } from '../database.ts';
import { seedUuid } from '../shared/ids.ts';
import { PERMISSIONS } from './data.ts';

type PermissionSeed = (typeof PERMISSIONS)[number];

export async function seedPermissions(
  client: SeedTransaction,
  permissions: readonly PermissionSeed[] = PERMISSIONS,
): Promise<Map<string, bigint>> {
  const permissionIds = new Map<string, bigint>();

  for (const permission of permissions) {
    const record = await client.authorizationPermission.upsert({
      where: { code: permission.code },
      update: {
        uuid: seedUuid('permission', permission.code),
        name: permission.name,
        module: permission.module,
        domain: permission.domain,
        action: permission.action,
      },
      create: {
        uuid: seedUuid('permission', permission.code),
        name: permission.name,
        code: permission.code,
        module: permission.module,
        domain: permission.domain,
        action: permission.action,
      },
    });

    permissionIds.set(permission.code, record.id);
  }

  return permissionIds;
}
