import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';
import type { SeedTransaction } from '../database.ts';
import { AGENT_MANAGEMENT_PERMISSIONS } from '../permissions/agent-management.ts';
import { AGENT_FIXTURES } from './data.ts';

const SPECIALIZATIONS = [
  { code: 'RESIDENTIAL', name: 'Residential', sortOrder: 10 },
  { code: 'COMMERCIAL', name: 'Commercial', sortOrder: 20 },
  { code: 'LUXURY', name: 'Luxury', sortOrder: 30 },
  { code: 'LAND', name: 'Land', sortOrder: 40 },
  { code: 'LEASING', name: 'Leasing', sortOrder: 50 },
] as const;

export async function seedAgentManagement(client: SeedTransaction, assignedByUserId: bigint): Promise<void> {
  const specializationIds = new Map<string, bigint>();
  for (const item of SPECIALIZATIONS) {
    const specialization = await client.agentSpecialization.upsert({
      where: { code: item.code },
      update: { name: item.name, sortOrder: item.sortOrder, isActive: true },
      create: { uuid: seedUuid('agent-specialization', item.code), code: item.code, name: item.name, sortOrder: item.sortOrder, isActive: true },
    });
    specializationIds.set(item.code, specialization.id);
  }

  const agentRole = await client.authorizationRole.upsert({
    where: { code: 'AGENT' },
    update: { name: 'Agent', description: 'Estate sales/property agent', isActive: true },
    create: { uuid: seedUuid('role', 'AGENT'), name: 'Agent', code: 'AGENT', description: 'Estate sales/property agent', isActive: true },
  });
  for (const { code } of AGENT_MANAGEMENT_PERMISSIONS) {
    const permission = await client.authorizationPermission.findUnique({ where: { code }, select: { id: true } });
    if (!permission) throw new Error(`Missing seeded Agent permission: ${code}`);
    await client.authorizationRolePermission.upsert({
      where: { roleId_permissionId: { roleId: agentRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: agentRole.id, permissionId: permission.id },
    });
  }

  for (const fixture of AGENT_FIXTURES) {
    const user = await client.authenticationUser.findUnique({ where: { uuid: fixture.userUuid }, select: { id: true, uuid: true } });
    if (!user) throw new Error(`Missing seeded agent user: ${fixture.userUuid}`);

    const profile = await client.agentProfile.upsert({
      where: { userUuid: user.uuid },
      update: { displayName: fixture.displayName, bio: fixture.bio, status: fixture.status, hireDate: new Date(fixture.hireDate), timeZone: fixture.timeZone, maxActiveAssignments: fixture.maxActiveAssignments, deletedAt: null, updatedBy: '00000000-0000-5000-8000-000000000001' },
      create: { uuid: seedUuid('agent-profile', fixture.userUuid), userUuid: user.uuid, displayName: fixture.displayName, bio: fixture.bio, status: fixture.status, hireDate: new Date(fixture.hireDate), timeZone: fixture.timeZone, maxActiveAssignments: fixture.maxActiveAssignments, createdBy: '00000000-0000-5000-8000-000000000001', updatedBy: '00000000-0000-5000-8000-000000000001' },
    });

    for (let index = 0; index < fixture.specializationCodes.length; index += 1) {
      const code = fixture.specializationCodes[index];
      const specializationId = specializationIds.get(code);
      if (!specializationId) throw new Error(`Missing specialization fixture: ${code}`);
      await client.agentSpecializationLink.upsert({
        where: { agentId_specializationId: { agentId: profile.id, specializationId } },
        update: { isPrimary: index === 0 },
        create: { agentId: profile.id, specializationId, isPrimary: index === 0 },
      });
    }

    await client.agentCoverage.upsert({
      where: { agentId_level_regionUuid: { agentId: profile.id, level: fixture.coverage.level, regionUuid: fixture.coverage.regionUuid } },
      update: { label: fixture.coverage.label, isActive: true, updatedBy: '00000000-0000-5000-8000-000000000001' },
      create: { uuid: seedUuid('agent-coverage', fixture.userUuid), agentId: profile.id, level: fixture.coverage.level, regionUuid: fixture.coverage.regionUuid, label: fixture.coverage.label, isActive: true, createdBy: '00000000-0000-5000-8000-000000000001', updatedBy: '00000000-0000-5000-8000-000000000001' },
    });
    await client.agentAvailability.upsert({
      where: { agentId: profile.id },
      update: { status: 'ACTIVE', timeZone: fixture.timeZone, effectiveAt: SEED_REFERENCE_DATE },
      create: { uuid: seedUuid('agent-availability', fixture.userUuid), agentId: profile.id, status: 'ACTIVE', timeZone: fixture.timeZone, effectiveAt: SEED_REFERENCE_DATE },
    });

    for (const weekday of [1, 2, 3, 4, 5]) {
      await client.agentWeeklySchedule.upsert({
        where: { agentId_weekday_startTime_endTime: { agentId: profile.id, weekday, startTime: '09:00', endTime: '17:00' } },
        update: { isActive: true },
        create: { uuid: seedUuid('agent-schedule', `${fixture.userUuid}:${weekday}`), agentId: profile.id, weekday, startTime: '09:00', endTime: '17:00', isActive: true },
      });
    }
    await client.agentTarget.upsert({
      where: { agentId_metricType_periodStart_periodEnd: { agentId: profile.id, metricType: 'CLOSED_DEALS', periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-03-31') } },
      update: { targetValue: '6', periodType: 'QUARTER', scope: 'ALL', status: 'ACTIVE', updatedBy: '00000000-0000-5000-8000-000000000001' },
      create: { uuid: seedUuid('agent-target', `${fixture.userUuid}:q1-2026`), agentId: profile.id, metricType: 'CLOSED_DEALS', periodType: 'QUARTER', periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-03-31'), targetValue: '6', scope: 'ALL', status: 'ACTIVE', createdBy: '00000000-0000-5000-8000-000000000001', updatedBy: '00000000-0000-5000-8000-000000000001' },
    });

    await client.authorizationUserRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: agentRole.id } },
      update: { isActive: true, revokedAt: null },
      create: { userId: user.id, roleId: agentRole.id, isActive: true, assignedBy: assignedByUserId, assignedAt: SEED_REFERENCE_DATE },
    });
  }
}

export const AGENT_MANAGEMENT_PERMISSION_CODES = AGENT_MANAGEMENT_PERMISSIONS.map(({ code }) => code);
