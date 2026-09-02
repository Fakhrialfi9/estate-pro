import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

type Delegate = { create(args: any): Promise<any>; findFirst(args: any): Promise<any | null>; findMany(args: any): Promise<any[]>; update(args: any): Promise<any>; count(args: any): Promise<number>; deleteMany(args: any): Promise<{ count: number }>; updateMany?(args: any): Promise<{ count: number }> };
type Client = { agentProfile: Delegate; agentSpecialization: Delegate; agentSpecializationLink: Delegate; agentCoverage: Delegate; agentAvailability: Delegate; agentWeeklySchedule: Delegate; agentAvailabilityException: Delegate; agentTarget: Delegate; $transaction<T>(fn: (tx: Client) => Promise<T>): Promise<T> };

@Injectable()
export class PrismaAgentRepository {
  private readonly db: Client;
  constructor(prisma: PrismaService) { this.db = prisma as unknown as Client; }
  createProfile(data: Record<string, unknown>) { return this.db.agentProfile.create({ data }); }
  findProfile(uuid: string) { return this.db.agentProfile.findFirst({ where: { uuid, deletedAt: null }, include: { specializations: { include: { specialization: true } }, coverages: true, availability: true, weeklySchedules: { where: { isActive: true } }, availabilityExceptions: true } }); }
  findProfileByUserUuid(userUuid: string) { return this.db.agentProfile.findFirst({ where: { userUuid, deletedAt: null } }); }
  listProfiles(query: { limit: number; cursor?: string; status?: string; specializationUuid?: string; regionUuids?: string[] }) {
    const where: Record<string, unknown> = { deletedAt: null, ...(query.status ? { status: query.status } : {}), ...(query.specializationUuid ? { specializations: { some: { specialization: { uuid: query.specializationUuid, isActive: true } } } } : {}), ...(query.regionUuids?.length ? { coverages: { some: { regionUuid: { in: query.regionUuids }, isActive: true } } } : {}), ...(query.cursor ? { uuid: { gt: query.cursor } } : {}) };
    return this.db.agentProfile.findMany({ where, take: Math.min(100, Math.max(1, query.limit)), orderBy: [{ uuid: 'asc' }], include: { specializations: { where: { specialization: { isActive: true } }, include: { specialization: true } }, coverages: { where: { isActive: true } }, availability: true, weeklySchedules: { where: { isActive: true } }, availabilityExceptions: true } });
  }
  updateProfile(uuid: string, data: Record<string, unknown>) { return this.db.agentProfile.update({ where: { uuid }, data }); }
  softDeleteProfile(uuid: string) { return this.db.agentProfile.update({ where: { uuid }, data: { status: 'ARCHIVED', deletedAt: new Date(), version: { increment: 1 } } }); }
  createSpecialization(data: Record<string, unknown>) { return this.db.agentSpecialization.create({ data }); }
  listSpecializations() { return this.db.agentSpecialization.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }); }
  findSpecialization(uuid: string) { return this.db.agentSpecialization.findFirst({ where: { uuid } }); }
  async setSpecialization(agentId: bigint, specializationId: bigint, isPrimary: boolean) { return this.db.$transaction(async (tx) => { if (isPrimary) await tx.agentSpecializationLink.updateMany?.({ where: { agentId }, data: { isPrimary: false } }); return tx.agentSpecializationLink.create({ data: { agentId, specializationId, isPrimary }, include: { specialization: true } }); }); }
  async removeSpecialization(agentId: bigint, specializationId: bigint) { await this.db.agentSpecializationLink.deleteMany({ where: { agentId, specializationId } }); }
  addCoverage(data: Record<string, unknown>) { return this.db.agentCoverage.create({ data }); }
  listCoverages(agentId: bigint) { return this.db.agentCoverage.findMany({ where: { agentId, isActive: true }, orderBy: [{ level: 'asc' }, { regionUuid: 'asc' }] }); }
  removeCoverage(uuid: string) { return this.db.agentCoverage.update({ where: { uuid }, data: { isActive: false } }); }
  async saveAvailability(input: { agentId: bigint; status: string; timeZone: string; effectiveAt: Date; schedule: Array<{ weekday: number; startTime: string; endTime: string }>; exceptions: Array<{ status: string; startsAt: Date; endsAt: Date; reason?: string }> }) {
    await this.db.$transaction(async (tx) => {
      const current = await tx.agentAvailability.findFirst({ where: { agentId: input.agentId } });
      if (current) await tx.agentAvailability.update({ where: { agentId: input.agentId }, data: { status: input.status, timeZone: input.timeZone, effectiveAt: input.effectiveAt } });
      else await tx.agentAvailability.create({ data: { agentId: input.agentId, status: input.status, timeZone: input.timeZone, effectiveAt: input.effectiveAt } });
      await tx.agentWeeklySchedule.deleteMany({ where: { agentId: input.agentId } });
      for (const item of input.schedule) await tx.agentWeeklySchedule.create({ data: { agentId: input.agentId, ...item, isActive: true } });
      await tx.agentAvailabilityException.deleteMany({ where: { agentId: input.agentId } });
      for (const item of input.exceptions) await tx.agentAvailabilityException.create({ data: { agentId: input.agentId, ...item } });
    });
  }
  createTarget(data: Record<string, unknown>) { return this.db.agentTarget.create({ data }); }
  findTarget(uuid: string) { return this.db.agentTarget.findFirst({ where: { uuid } }); }
  listTargets(agentId: bigint, date = new Date()) { return this.db.agentTarget.findMany({ where: { agentId, status: 'ACTIVE', periodStart: { lte: date }, periodEnd: { gte: date } }, orderBy: [{ periodStart: 'desc' }] }); }
  updateTarget(uuid: string, data: Record<string, unknown>) { return this.db.agentTarget.update({ where: { uuid }, data }); }
  closeTarget(uuid: string) { return this.db.agentTarget.update({ where: { uuid }, data: { status: 'CLOSED' } }); }
}
