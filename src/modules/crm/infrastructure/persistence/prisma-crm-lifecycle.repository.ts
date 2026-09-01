import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { CrmActor } from '../../domain/crm.types.js';

export interface ScopedLead {
  readonly uuid: string;
  readonly statusCode: string;
  readonly contactUuid: string;
  readonly ownerUserUuid: string | null;
  readonly accessible: boolean;
}

@Injectable()
export class PrismaCrmLifecycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getScopedLead(
    uuid: string,
    actorUuid: string,
    globalAccess: boolean,
  ): Promise<ScopedLead> {
    const lead = await this.prisma.crmLead.findFirst({
      where: { uuid, archivedAt: null },
      include: {
        status: true,
        contact: { select: { uuid: true, ownerUserUuid: true } },
        assignments: {
          where: { unassignedAt: null },
          select: { assigneeUserUuid: true },
        },
      },
    });
    if (!lead) throw new Error('Lead not found');
    const accessible =
      globalAccess ||
      lead.ownerUserUuid === actorUuid ||
      lead.contact.ownerUserUuid === actorUuid ||
      lead.assignments.some((a) => a.assigneeUserUuid === actorUuid);
    return {
      uuid: lead.uuid,
      statusCode: lead.status.code,
      contactUuid: lead.contact.uuid,
      ownerUserUuid: lead.ownerUserUuid,
      accessible,
    };
  }

  async setLifecycle(input: {
    readonly leadUuid: string;
    readonly toStatus: string;
    readonly actor: CrmActor;
    readonly qualificationReason?: string;
    readonly closureReason?: string;
    readonly closureOutcome?: string;
  }): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.crmLead.findFirst({
        where: { uuid: input.leadUuid, archivedAt: null },
        include: { status: true },
      });
      if (!current) throw new Error('Lead not found');

      const next = await tx.crmLeadStatus.findFirst({
        where: { code: input.toStatus, isActive: true, deletedAt: null },
      });
      if (!next) throw new Error(`CRM status ${input.toStatus} is not configured`);

      const transition = await tx.crmLeadStatusTransition.findFirst({
        where: { fromStatusId: current.statusId, toStatusId: next.id },
      });
      if (!transition && current.status.code !== next.code) {
        throw new Error(
          `Invalid transition ${current.status.code} -> ${next.code}`,
        );
      }

      const now = new Date();
      const updated = await tx.crmLead.update({
        where: { id: current.id },
        data: {
          statusId: next.id,
          ...(next.code === 'QUALIFIED'
            ? {
                qualifiedAt: now,
                qualificationReason: input.qualificationReason ?? null,
              }
            : {}),
          ...(next.code === 'CLOSED_LOST' || next.code === 'CLOSED_WON'
            ? {
                closedAt: now,
                closureReason: input.closureReason ?? null,
                closureOutcome: input.closureOutcome ?? null,
              }
            : {}),
        },
        include: { status: true },
      });

      if (current.status.code !== next.code) {
        await tx.crmLeadHistory.create({
          data: {
            uuid: randomUUID(),
            leadId: current.id,
            eventType: 'STATUS_CHANGED',
            fromValue: current.status.code,
            toValue: next.code,
            summary:
              [
                input.qualificationReason,
                input.closureReason,
                input.closureOutcome,
              ]
                .filter(Boolean)
                .join(' | ') || `Lead status changed to ${next.code}`,
            actorUserUuid: input.actor.actorUuid || null,
          },
        });
      }
      return updated;
    });
  }

  async markConverted(leadUuid: string, conversionKey: string): Promise<void> {
    await this.prisma.crmLead.updateMany({
      where: { uuid: leadUuid, convertedAt: null, conversionKey: null },
      data: { convertedAt: new Date(), conversionKey },
    });
  }
}
