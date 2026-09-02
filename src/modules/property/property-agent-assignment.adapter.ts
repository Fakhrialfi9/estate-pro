import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type {
  PropertyAgentAssignmentPort,
  PropertyAgentAssignmentRecord,
} from '../../common/contracts/property-agent-assignment.port.js';

type AssignmentRow = Awaited<
  ReturnType<PrismaService['propertyAgentAssignment']['findFirst']>
>;

@Injectable()
export class PrismaPropertyAgentAssignmentAdapter
  implements PropertyAgentAssignmentPort
{
  constructor(private readonly db: PrismaService) {}

  async assign(input: {
    propertyUuid: string;
    agentUserUuid: string;
    agentDisplayName: string;
    actorUuid: string;
  }): Promise<PropertyAgentAssignmentRecord> {
    return this.db.$transaction(async (tx) => {
      const property = await tx.property.findFirst({
        where: { uuid: input.propertyUuid, deletedAt: null },
      });
      if (!property) throw new NotFoundException('Property not found');

      await tx.$queryRaw<readonly { id: bigint }[]>`
        SELECT id FROM properties WHERE id = ${property.id} FOR UPDATE
      `;

      const current = await tx.propertyAgentAssignment.findFirst({
        where: { propertyId: property.id, agentUserUuid: input.agentUserUuid },
      });
      if (current?.unassignedAt === null) {
        throw new ConflictException('Agent is already assigned to property');
      }

      const assignment = current
        ? await tx.propertyAgentAssignment.update({
            where: { uuid: current.uuid },
            data: {
              agentDisplayName: input.agentDisplayName,
              assignedAt: new Date(),
              unassignedAt: null,
              createdBy: current.createdBy ?? input.actorUuid,
              updatedBy: input.actorUuid,
              isPrimary: true,
            },
          })
        : await tx.propertyAgentAssignment.create({
            data: {
              uuid: randomUUID(),
              propertyId: property.id,
              agentUserUuid: input.agentUserUuid,
              agentDisplayName: input.agentDisplayName,
              isPrimary: true,
              createdBy: input.actorUuid,
            },
          });

      await tx.propertyAgentAssignmentHistory.create({
        data: {
          uuid: randomUUID(),
          propertyId: property.id,
          propertyUuid: property.uuid,
          agentUserUuid: input.agentUserUuid,
          actorUserUuid: input.actorUuid,
          action: 'ASSIGN',
        },
      });

      return this.map(property.uuid, assignment);
    });
  }

  async unassign(input: {
    propertyUuid: string;
    agentUserUuid: string;
    actorUuid: string;
  }): Promise<PropertyAgentAssignmentRecord> {
    return this.db.$transaction(async (tx) => {
      const property = await tx.property.findFirst({
        where: { uuid: input.propertyUuid, deletedAt: null },
      });
      if (!property) throw new NotFoundException('Property not found');

      await tx.$queryRaw<readonly { id: bigint }[]>`
        SELECT id FROM properties WHERE id = ${property.id} FOR UPDATE
      `;

      const current = await tx.propertyAgentAssignment.findFirst({
        where: {
          propertyId: property.id,
          agentUserUuid: input.agentUserUuid,
          unassignedAt: null,
        },
      });
      if (!current) {
        throw new NotFoundException('Active property assignment not found');
      }

      const assignment = await tx.propertyAgentAssignment.update({
        where: { uuid: current.uuid },
        data: {
          unassignedAt: new Date(),
          updatedBy: input.actorUuid,
          isPrimary: false,
        },
      });

      await tx.propertyAgentAssignmentHistory.create({
        data: {
          uuid: randomUUID(),
          propertyId: property.id,
          propertyUuid: property.uuid,
          agentUserUuid: input.agentUserUuid,
          actorUserUuid: input.actorUuid,
          action: 'UNASSIGN',
        },
      });

      return this.map(property.uuid, assignment);
    });
  }

  async reassign(input: {
    propertyUuid: string;
    fromAgentUserUuid?: string;
    toAgentUserUuid: string;
    toAgentDisplayName: string;
    actorUuid: string;
  }): Promise<PropertyAgentAssignmentRecord> {
    return this.db.$transaction(async (tx) => {
      const property = await tx.property.findFirst({
        where: { uuid: input.propertyUuid, deletedAt: null },
      });
      if (!property) throw new NotFoundException('Property not found');

      await tx.$queryRaw<readonly { id: bigint }[]>`
        SELECT id FROM properties WHERE id = ${property.id} FOR UPDATE
      `;

      if (
        input.fromAgentUserUuid &&
        input.fromAgentUserUuid !== input.toAgentUserUuid
      ) {
        const from = await tx.propertyAgentAssignment.findFirst({
          where: {
            propertyId: property.id,
            agentUserUuid: input.fromAgentUserUuid,
            unassignedAt: null,
          },
        });
        if (from) {
          await tx.propertyAgentAssignment.update({
            where: { uuid: from.uuid },
            data: {
              unassignedAt: new Date(),
              isPrimary: false,
              updatedBy: input.actorUuid,
            },
          });
          await tx.propertyAgentAssignmentHistory.create({
            data: {
              uuid: randomUUID(),
              propertyId: property.id,
              propertyUuid: property.uuid,
              agentUserUuid: input.fromAgentUserUuid,
              actorUserUuid: input.actorUuid,
              action: 'UNASSIGN',
            },
          });
        }
      }

      const existing = await tx.propertyAgentAssignment.findFirst({
        where: {
          propertyId: property.id,
          agentUserUuid: input.toAgentUserUuid,
        },
      });
      if (existing?.unassignedAt === null) {
        throw new ConflictException(
          'Target agent is already assigned to property',
        );
      }

      const assignment = existing
        ? await tx.propertyAgentAssignment.update({
            where: { uuid: existing.uuid },
            data: {
              agentDisplayName: input.toAgentDisplayName,
              assignedAt: new Date(),
              unassignedAt: null,
              isPrimary: true,
              updatedBy: input.actorUuid,
            },
          })
        : await tx.propertyAgentAssignment.create({
            data: {
              uuid: randomUUID(),
              propertyId: property.id,
              agentUserUuid: input.toAgentUserUuid,
              agentDisplayName: input.toAgentDisplayName,
              isPrimary: true,
              createdBy: input.actorUuid,
            },
          });

      await tx.propertyAgentAssignmentHistory.create({
        data: {
          uuid: randomUUID(),
          propertyId: property.id,
          propertyUuid: property.uuid,
          agentUserUuid: input.toAgentUserUuid,
          actorUserUuid: input.actorUuid,
          action: 'REASSIGN',
        },
      });

      return this.map(property.uuid, assignment);
    });
  }

  async isAssigned(
    propertyUuid: string,
    agentUserUuid: string,
  ): Promise<boolean> {
    return Boolean(
      await this.db.propertyAgentAssignment.findFirst({
        where: {
          property: { uuid: propertyUuid },
          agentUserUuid,
          unassignedAt: null,
        },
      }),
    );
  }

  async listCurrent(
    agentUserUuid: string,
    limit: number,
    cursor?: string,
  ): Promise<PropertyAgentAssignmentRecord[]> {
    const rows = await this.db.propertyAgentAssignment.findMany({
      where: {
        agentUserUuid,
        unassignedAt: null,
        ...(cursor ? { uuid: { gt: cursor } } : {}),
      },
      orderBy: [{ uuid: 'asc' }],
      take: Math.min(100, Math.max(1, limit)),
      include: { property: true },
    });
    return rows.map((row) => this.map(row.property.uuid, row));
  }

  async listHistory(
    agentUserUuid: string,
    limit: number,
  ): Promise<PropertyAgentAssignmentRecord[]> {
    const rows = await this.db.propertyAgentAssignmentHistory.findMany({
      where: { agentUserUuid },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: Math.min(100, Math.max(1, limit)),
    });
    return rows.map((row) => ({
      uuid: row.uuid,
      propertyUuid: row.propertyUuid,
      agentUserUuid: row.agentUserUuid,
      agentDisplayName: '',
      isPrimary: false,
      assignedAt: row.occurredAt,
      unassignedAt: row.action === 'UNASSIGN' ? row.occurredAt : null,
    }));
  }

  countCurrent(agentUserUuid: string): Promise<number> {
    return this.db.propertyAgentAssignment.count({
      where: { agentUserUuid, unassignedAt: null },
    });
  }

  private map(
    propertyUuid: string,
    row: Exclude<AssignmentRow, null>,
  ): PropertyAgentAssignmentRecord {
    return {
      uuid: row.uuid,
      propertyUuid,
      agentUserUuid: row.agentUserUuid,
      agentDisplayName: row.agentDisplayName,
      isPrimary: row.isPrimary,
      assignedAt: row.assignedAt,
      unassignedAt: row.unassignedAt,
    };
  }
}
