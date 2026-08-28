import { PERMISSIONS } from './permissions/data.ts';
import { seedPermissions } from './permissions/seed.ts';
import { seedRoles, seedRolePermissions } from './roles/seed.ts';
import {
  assignAdminRole,
  seedAdminUser,
  seedDevelopmentUsers,
} from './users/seed.ts';
import { createDatabaseClient } from './database.ts';

export async function seedDatabase(): Promise<void> {
  const prisma = createDatabaseClient();

  try {
    await prisma.$transaction(async (tx) => {
      const permissionIds = await seedPermissions(tx);
      const roleIds = await seedRoles(tx);

      await seedRolePermissions(
        tx,
        roleIds,
        permissionIds,
        PERMISSIONS.map(({ code }) => code),
      );

      const adminUserId = await seedAdminUser(tx);
      const adminRoleId = roleIds.get('ADMIN');
      if (adminRoleId === undefined) {
        throw new Error('Missing seeded ADMIN role');
      }

      await assignAdminRole(tx, adminUserId, adminRoleId);
      await seedDevelopmentUsers(tx);
    });
  } finally {
    await prisma.$disconnect();
  }
}
