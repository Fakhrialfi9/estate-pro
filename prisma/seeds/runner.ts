import { CONTENT_EXTRA_PERMISSIONS, CONTENT_PERMISSIONS } from './permissions/content.ts';
import { CRM_PERMISSIONS } from './permissions/crm.ts';
import { PERMISSIONS } from './permissions/data.ts';
import { SALES_PERMISSIONS } from './permissions/sales.ts';
import { seedPermissions } from './permissions/seed.ts';
import { seedRoles, seedRolePermissions } from './roles/seed.ts';
import {
  ADMIN_USER,
  SEED_USERS,
  assignAdminRole,
  prepareUserSeed,
  seedAdminUser,
  seedDevelopmentUsers,
} from './users/seed.ts';
import { createDatabaseClient } from './database.ts';
import { seedCrm } from './crm.ts';
import { seedSales } from './sales.ts';

export async function seedDatabase(): Promise<void> {
  const prisma = createDatabaseClient();
  const [preparedAdmin, ...preparedUsers] = await Promise.all([
    prepareUserSeed(ADMIN_USER),
    ...SEED_USERS.map(prepareUserSeed),
  ]);
  const permissions = [
    ...PERMISSIONS,
    ...CONTENT_PERMISSIONS,
    ...CONTENT_EXTRA_PERMISSIONS,
    ...CRM_PERMISSIONS,
    ...SALES_PERMISSIONS,
  ];

  try {
    await prisma.$transaction(async (tx) => {
      const permissionIds = await seedPermissions(tx);
      for (const permission of permissions) {
        const record = await tx.authorizationPermission.upsert({
          where: { code: permission.code },
          update: {
            name: permission.name,
            module: permission.module,
            domain: permission.domain,
            action: permission.action,
          },
          create: {
            uuid: crypto.randomUUID(),
            name: permission.name,
            code: permission.code,
            module: permission.module,
            domain: permission.domain,
            action: permission.action,
          },
        });
        permissionIds.set(permission.code, record.id);
      }

      const roleIds = await seedRoles(tx);
      await seedRolePermissions(
        tx,
        roleIds,
        permissionIds,
        permissions.map(({ code }) => code),
      );
      const adminUserId = await seedAdminUser(tx, preparedAdmin);
      const adminRoleId = roleIds.get('ADMIN');
      if (adminRoleId === undefined) {
        throw new Error('Missing seeded ADMIN role');
      }
      await assignAdminRole(tx, adminUserId, adminRoleId);
      await seedDevelopmentUsers(tx, preparedUsers);
      await seedCrm(tx);
      await seedSales(tx);
    });
  } finally {
    await prisma.$disconnect();
  }
}
