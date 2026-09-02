import { randomUUID } from 'node:crypto';
import type { SeedTransaction } from '../database.ts';
import { AGENT_MANAGEMENT_PERMISSIONS } from '../permissions/agent-management.ts';

const SPECIALIZATIONS = [
  { code: 'RESIDENTIAL', name: 'Residential', sortOrder: 10 },
  { code: 'COMMERCIAL', name: 'Commercial', sortOrder: 20 },
  { code: 'LUXURY', name: 'Luxury', sortOrder: 30 },
  { code: 'LAND', name: 'Land', sortOrder: 40 },
  { code: 'LEASING', name: 'Leasing', sortOrder: 50 },
] as const;

export async function seedAgentManagement(client: SeedTransaction): Promise<void> {
  for (const item of SPECIALIZATIONS) {
    await client.agentSpecialization.upsert({
      where: { code: item.code },
      update: { name: item.name, sortOrder: item.sortOrder, isActive: true },
      create: { uuid: randomUUID(), code: item.code, name: item.name, sortOrder: item.sortOrder, isActive: true },
    });
  }
  const agentRole = await client.authorizationRole.upsert({
    where: { code: 'AGENT' },
    update: { name: 'Agent', description: 'Estate sales/property agent', isActive: true },
    create: { uuid: randomUUID(), name: 'Agent', code: 'AGENT', description: 'Estate sales/property agent', isActive: true },
  });
  const codes = ['agents.access', 'agents.read', 'agents.assignment.self', 'agents.target.read', 'agents.performance.read'];
  for (const code of codes) {
    const permission = await client.authorizationPermission.findUnique({ where: { code }, select: { id: true } });
    if (!permission) throw new Error(`Missing seeded Agent permission: ${code}`);
    await client.authorizationRolePermission.upsert({
      where: { roleId_permissionId: { roleId: agentRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: agentRole.id, permissionId: permission.id },
    });
  }
}

export const AGENT_MANAGEMENT_PERMISSION_CODES = AGENT_MANAGEMENT_PERMISSIONS.map(({ code }) => code);
