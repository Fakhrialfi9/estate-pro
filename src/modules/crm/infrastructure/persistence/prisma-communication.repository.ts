import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  CommunicationRecord,
  CommunicationRepository,
} from '../../domain/repositories/communication.repository.js';

type CommunicationWithRelations = Prisma.CrmCommunicationGetPayload<{
  include: {
    contact: { select: { uuid: true } };
    lead: { select: { uuid: true } };
    activity: { select: { uuid: true } };
    template: { select: { uuid: true } };
  };
}>;

@Injectable()
export class PrismaCommunicationRepository implements CommunicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUuid(uuid: string): Promise<CommunicationRecord | null> {
    const row = await this.prisma.crmCommunication.findUnique({
      where: { uuid },
      include: this.relationsInclude(),
    });
    return row ? this.toRecord(row) : null;
  }

  async transitionCommunication(
    uuid: string,
    status: string,
    input: {
      providerMessageId?: string;
      providerError?: string;
    } = {},
  ): Promise<CommunicationRecord> {
    const current = await this.prisma.crmCommunication.findUnique({
      where: { uuid },
      include: this.relationsInclude(),
    });
    if (!current) throw new Error('Communication not found');

    const allowed: Record<string, readonly string[]> = {
      QUEUED: ['SENT', 'FAILED', 'CANCELLED'],
      SENT: ['DELIVERED', 'FAILED'],
      DELIVERED: [],
      FAILED: [],
      CANCELLED: [],
    };

    if (
      status !== current.status &&
      !allowed[current.status]?.includes(status)
    ) {
      throw new Error(
        `Invalid communication transition ${current.status} -> ${status}`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.crmCommunication.update({
      where: { id: current.id },
      data: {
        status,
        ...(input.providerMessageId !== undefined
          ? { providerMessageId: input.providerMessageId }
          : {}),
        ...(input.providerError !== undefined
          ? { providerError: input.providerError }
          : {}),
        ...(status === 'SENT' ? { sentAt: now } : {}),
        ...(status === 'DELIVERED' ? { deliveredAt: now } : {}),
        ...(status === 'FAILED' ? { failedAt: now } : {}),
      },
      include: this.relationsInclude(),
    });

    return this.toRecord(updated);
  }

  private relationsInclude() {
    return {
      contact: { select: { uuid: true } },
      lead: { select: { uuid: true } },
      activity: { select: { uuid: true } },
      template: { select: { uuid: true } },
    } as const;
  }

  private toRecord(row: CommunicationWithRelations): CommunicationRecord {
    return {
      uuid: row.uuid,
      channel: row.channel,
      direction: row.direction,
      status: row.status,
      contactUuid: row.contact?.uuid ?? null,
      leadUuid: row.lead?.uuid ?? null,
      activityUuid: row.activity?.uuid ?? null,
      templateUuid: row.template?.uuid ?? null,
      providerName: row.providerName,
      providerMessageId: row.providerMessageId,
      providerError: row.providerError,
      destination: row.destination,
      subject: row.subject,
      body: row.body,
    };
  }
}
