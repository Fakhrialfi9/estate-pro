import { PERMISSIONS } from './permissions/data.ts';
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
import { seedAudit } from './audit/seed.ts';
import { seedCrm } from './crm/seed.ts';
import { seedSales } from './sales/seed.ts';
import { seedAgentManagement } from './agent-management/seed.ts';
import { seedProperty } from './property/seed.ts';
import { seedPropertyMatching } from './property-matching/seed.ts';
import { seedAutomation } from './automation/seed.ts';
import { seedContent } from './content/seed.ts';
import { seedSystem } from './system/seed.ts';
import { expandSeedDataset, verifyExpandedSeedState } from './expansion.ts';
import { seedSemanticCoverage } from './semantic-expansion.ts';
import { verifySeedState } from './verification.ts';
import { sanitizeSemanticCoverage } from './semantic-sanity.ts';
import { verifySemanticSeedCoverage } from './semantic-verification.ts';

export async function seedDatabase(): Promise<void> {
  const prisma = createDatabaseClient();
  const [preparedAdmin, ...preparedUsers] = await Promise.all([
    prepareUserSeed(ADMIN_USER),
    ...SEED_USERS.map(prepareUserSeed),
  ]);

  try {
    await prisma.$transaction(async (tx) => {
      const permissionIds = await seedPermissions(tx, PERMISSIONS);
      const roleIds = await seedRoles(tx);
      await seedRolePermissions(
        tx,
        roleIds,
        permissionIds,
        PERMISSIONS.map(({ code }) => code),
      );

      const adminUserId = await seedAdminUser(tx, preparedAdmin);
      const adminRoleId = roleIds.get('ADMIN');
      if (adminRoleId === undefined) {
        throw new Error('Missing seeded ADMIN role');
      }
      await assignAdminRole(tx, adminUserId, adminRoleId);
      await seedDevelopmentUsers(tx, preparedUsers);

      await seedAgentManagement(tx, adminUserId);
      await seedProperty(tx);
      await seedAudit(tx);
      await seedCrm(tx);
      await seedSales(tx);
      await seedPropertyMatching(tx);
      await seedAutomation(tx);
      await seedContent(tx);
      await seedSystem(tx);

      // Existing bounded-context fixtures remain the first source of truth.
      // The legacy expansion is the first fallback, followed by the
      // relationship-aware expansion for tables missed by the original
      // registry or requiring higher dashboard-oriented targets.
      await expandSeedDataset(prisma, tx);
      await seedSemanticCoverage(tx);
      await sanitizeSemanticCoverage(tx);
    });

    await verifySeedState(prisma);
    await verifyExpandedSeedState(prisma);
    await verifySemanticSeedCoverage(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
