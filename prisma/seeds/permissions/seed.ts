import { randomUUID } from 'node:crypto';

import type { SeedTransaction } from '../database.ts';
import { PERMISSIONS } from './data.ts';

export async function seedPermissions(
  client: SeedTransaction,
): Promise<Map<string, bigint>> {
  const permissionIds = new Map<string, bigint>();

  for (const permission of PERMISSIONS) {
    const record = await client.authorizationPermission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        module: permission.module,
        domain: permission.domain,
        action: permission.action,
      },
      create: {
        uuid: randomUUID(),
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
