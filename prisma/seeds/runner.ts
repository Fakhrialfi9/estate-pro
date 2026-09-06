import { CONTENT_EXTRA_PERMISSIONS, CONTENT_PERMISSIONS } from './permissions/content.ts';
import { CRM_PERMISSIONS } from './permissions/crm.ts';
import { PERMISSIONS } from './permissions/data.ts';
import { SALES_PERMISSIONS } from './permissions/sales.ts';
import { AGENT_MANAGEMENT_PERMISSIONS } from './permissions/agent-management.ts';
import { ANALYTICS_PERMISSIONS } from './permissions/analytics.ts';
import { SYSTEM_PERMISSIONS } from './permissions/system.ts';
import { seedPermissions } from './permissions/seed.ts';
import { seedRoles, seedRolePermissions } from './roles/seed.ts';
import { ADMIN_USER, SEED_USERS, assignAdminRole, prepareUserSeed, seedAdminUser, seedDevelopmentUsers } from './users/seed.ts';
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
import { verifySeedState } from './verification.ts';

export async function seedDatabase(): Promise<void> {
  const prisma = createDatabaseClient();
  const [preparedAdmin, ...preparedUsers] = await Promise.all([prepareUserSeed(ADMIN_USER), ...SEED_USERS.map(prepareUserSeed)]);
  const permissions = [...PERMISSIONS, ...SYSTEM_PERMISSIONS, ...CONTENT_PERMISSIONS, ...CONTENT_EXTRA_PERMISSIONS, ...CRM_PERMISSIONS, ...SALES_PERMISSIONS, ...AGENT_MANAGEMENT_PERMISSIONS, ...ANALYTICS_PERMISSIONS];

  try {
    await prisma.$transaction(async (tx) => {
      const permissionIds = await seedPermissions(tx, permissions);
      const roleIds = await seedRoles(tx);
      await seedRolePermissions(tx, roleIds, permissionIds, permissions.map(({ code }) => code));

      const adminUserId = await seedAdminUser(tx, preparedAdmin);
      const adminRoleId = roleIds.get('ADMIN');
      if (adminRoleId === undefined) throw new Error('Missing seeded ADMIN role');
      await assignAdminRole(tx, adminUserId, adminRoleId);
      await seedDevelopmentUsers(tx, preparedUsers);

      // Dependency order: identity/RBAC -> agents -> property -> audit -> CRM -> sales -> matching -> automation/content/system.
      await seedAgentManagement(tx, adminUserId);
      await seedProperty(tx);
      await seedAudit(tx);
      await seedCrm(tx);
      await seedSales(tx);
      await seedPropertyMatching(tx);
      await seedAutomation(tx);
      await seedContent(tx);
      await seedSystem(tx);
      await expandSeedDataset(prisma, tx);
    });

    await verifySeedState(prisma);
    await verifyExpandedSeedState(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
