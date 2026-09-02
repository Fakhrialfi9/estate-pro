import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type { PropertyAgentAssignmentPort, PropertyAgentAssignmentRecord } from '../../common/contracts/property-agent-assignment.port.js';

type Db = {
  property: any;
  propertyAgentAssignment: any;
  propertyAgentAssignmentHistory: any;
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
};

@Injectable()
export class PrismaPropertyAgentAssignmentAdapter implements PropertyAgentAssignmentPort {
  private readonly db: Db;
  constructor(prisma: PrismaService) { this.db = prisma as unknown as Db; }
  async assign(input: { propertyUuid: string; agentUserUuid: string; actorUuid: string; reason?: string }): Promise<PropertyAgentAssignmentRecord> {
    return this.db.$transaction(async (tx) => {
      const property = await tx.property.findFirst({ where: { uuid: input.propertyUuid, deletedAt: null } });
      if (!property) throw new NotFoundException('Property not found');
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${property.id} FOR UPDATE`;
      const current = await tx.propertyAgentAssignment.findFirst({ where: { propertyId: property.id, agentUserUuid: input.agentUserUuid } });
      if (current?.unassignedAt === null) throw new ConflictException('Agent is already assigned to property');
      const assignment = current
        ? await tx.propertyAgentAssignment.update({ where: { uuid: current.uuid }, data: { assignedByUuid: input.actorUuid, assignedAt: new Date(), unassignedAt: null, unassignedByUuid: null, reason: input.reason ?? null, version: { increment: 1 } } })
        : await tx.propertyAgentAssignment.create({ data: { uuid: crypto.randomUUID(), propertyId: property.id, agentUserUuid: input.agentUserUuid, assignedByUuid: input.actorUuid, reason: input.reason ?? null } });
      await tx.propertyAgentAssignmentHistory.create({ data: { uuid: crypto.randomUUID(), propertyId: property.id, propertyUuid: property.uuid, agentUserUuid: input.agentUserUuid, actorUserUuid: input.actorUuid, action: 'ASSIGN', reason: input.reason ?? null } });
      return this.map(property.uuid, assignment);
    });
  }
  async unassign(input: { propertyUuid: string; agentUserUuid: string; actorUuid: string; reason?: string }): Promise<PropertyAgentAssignmentRecord> {
    return this.db.$transaction(async (tx) => {
      const property = await tx.property.findFirst({ where: { uuid: input.propertyUuid, deletedAt: null } });
      if (!property) throw new NotFoundException('Property not found');
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${property.id} FOR UPDATE`;
      const current = await tx.propertyAgentAssignment.findFirst({ where: { propertyId: property.id, agentUserUuid: input.agentUserUuid } });
      if (!current || current.unassignedAt !== null) throw new NotFoundException('Active property assignment not found');
      const assignment = await tx.propertyAgentAssignment.update({ where: { uuid: current.uuid }, data: { unassignedAt: new Date(), unassignedByUuid: input.actorUuid, reason: input.reason ?? current.reason, version: { increment: 1 } } });
      await tx.propertyAgentAssignmentHistory.create({ data: { uuid: crypto.randomUUID(), propertyId: property.id, propertyUuid: property.uuid, agentUserUuid: input.agentUserUuid, actorUserUuid: input.actorUuid, action: 'UNASSIGN', reason: input.reason ?? null } });
      return this.map(property.uuid, assignment);
    });
  }
  async reassign(input: { propertyUuid: string; fromAgentUserUuid?: string; toAgentUserUuid: string; actorUuid: string; reason?: string }): Promise<PropertyAgentAssignmentRecord> {
    return this.db.$transaction(async (tx) => {
      const property = await tx.property.findFirst({ where: { uuid: input.propertyUuid, deletedAt: null } });
      if (!property) throw new NotFoundException('Property not found');
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${property.id} FOR UPDATE`;
      if (input.fromAgentUserUuid && input.fromAgentUserUuid !== input.toAgentUserUuid) {
        const from = await tx.propertyAgentAssignment.findFirst({ where: { propertyId: property.id, agentUserUuid: input.fromAgentUserUuid } });
        if (from && from.unassignedAt === null) await tx.propertyAgentAssignment.update({ where: { uuid: from.uuid }, data: { unassignedAt: new Date(), unassignedByUuid: input.actorUuid, version: { increment: 1 } } });
      }
      const existing = await tx.propertyAgentAssignment.findFirst({ where: { propertyId: property.id, agentUserUuid: input.toAgentUserUuid } });
      if (existing?.unassignedAt === null) throw new ConflictException('Target agent is already assigned to property');
      const assignment = existing
        ? await tx.propertyAgentAssignment.update({ where: { uuid: existing.uuid }, data: { assignedByUuid: input.actorUuid, assignedAt: new Date(), unassignedAt: null, unassignedByUuid: null, reason: input.reason ?? null, version: { increment: 1 } } })
        : await tx.propertyAgentAssignment.create({ data: { uuid: crypto.randomUUID(), propertyId: property.id, agentUserUuid: input.toAgentUserUuid, assignedByUuid: input.actorUuid, reason: input.reason ?? null } });
      await tx.propertyAgentAssignmentHistory.create({ data: { uuid: crypto.randomUUID(), propertyId: property.id, propertyUuid: property.uuid, agentUserUuid: input.toAgentUserUuid, actorUserUuid: input.actorUuid, action: 'REASSIGN', reason: input.reason ?? null } });
      return this.map(property.uuid, assignment);
    });
  }
  async isAssigned(propertyUuid: string, agentUserUuid: string) { return Boolean(await this.db.propertyAgentAssignment.findFirst({ where: { property: { uuid: propertyUuid }, agentUserUuid, unassignedAt: null } })); }
  async listCurrent(agentUserUuid: string, limit: number, cursor?: string) { const rows = await this.db.propertyAgentAssignment.findMany({ where: { agentUserUuid, unassignedAt: null, ...(cursor ? { uuid: { gt: cursor } } : {}) }, orderBy: [{ uuid: 'asc' }], take: Math.min(100, Math.max(1, limit)), include: { property: true } }); return rows.map((x: any) => this.map(x.property.uuid, x)); }
  async listHistory(agentUserUuid: string, limit: number) { const rows = await this.db.propertyAgentAssignmentHistory.findMany({ where: { agentUserUuid }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: Math.min(100, Math.max(1, limit)) }); return rows.map((x: any) => ({ uuid: x.uuid, propertyUuid: x.propertyUuid, agentUserUuid: x.agentUserUuid, assignedAt: x.occurredAt, unassignedAt: x.action === 'UNASSIGN' ? x.occurredAt : null, version: 0 })); }
  countCurrent(agentUserUuid: string) { return this.db.propertyAgentAssignment.count({ where: { agentUserUuid, unassignedAt: null } }); }
  private map(propertyUuid: string, row: any): PropertyAgentAssignmentRecord { return { uuid: row.uuid, propertyUuid, agentUserUuid: row.agentUserUuid, assignedAt: row.assignedAt, unassignedAt: row.unassignedAt ?? null, version: row.version }; }
}
