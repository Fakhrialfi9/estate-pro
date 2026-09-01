import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';
import type {
  SalesConversionInput,
  SalesConversionPort,
  SalesConversionResult,
} from '../../common/contracts/sales-conversion.port.js';

@Injectable()
export class PrismaSalesConversionAdapter implements SalesConversionPort {
  constructor(private readonly prisma: PrismaService) {}

  async createFromQualifiedLead(
    input: SalesConversionInput,
  ): Promise<SalesConversionResult> {
    const existing = await this.prisma.salesOpportunity.findUnique({
      where: { leadUuid: input.leadUuid },
    });
    if (existing) {
      return { opportunityUuid: existing.uuid, created: false };
    }

    try {
      const created = await this.prisma.salesOpportunity.create({
        data: {
          uuid: randomUUID(),
          leadUuid: input.leadUuid,
          contactUuid: input.contactUuid,
          ownerUserUuid: input.ownerUserUuid,
          status: 'OPEN',
          idempotencyKey: input.idempotencyKey,
        },
      });
      return { opportunityUuid: created.uuid, created: true };
    } catch (error) {
      const raced = await this.prisma.salesOpportunity.findUnique({
        where: { leadUuid: input.leadUuid },
      });
      if (raced) return { opportunityUuid: raced.uuid, created: false };
      throw error;
    }
  }
}
