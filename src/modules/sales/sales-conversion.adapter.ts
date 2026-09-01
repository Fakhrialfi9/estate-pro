import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  SalesConversionInput,
  SalesConversionPort,
  SalesConversionResult,
} from '../../common/contracts/sales-conversion.port.js';
import { SALES_REPOSITORY } from './domain/repositories/sales.repository.js';
import type { SalesRepository } from './domain/repositories/sales.repository.js';

@Injectable()
export class PrismaSalesConversionAdapter implements SalesConversionPort {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repository: SalesRepository,
  ) {}

  async createFromQualifiedLead(
    input: SalesConversionInput,
  ): Promise<SalesConversionResult> {
    if (!input.idempotencyKey.trim()) {
      throw new ConflictException('Conversion idempotency key is required');
    }

    const existing = await this.repository.findConversion(input.leadUuid);
    if (existing) {
      return { opportunityUuid: existing.uuid, created: false };
    }

    const opportunity = await this.repository.createOpportunity({
      leadUuid: input.leadUuid,
      contactUuid: input.contactUuid,
      ownerUserUuid: input.ownerUserUuid,
      title: `Opportunity from qualified lead ${input.leadUuid}`,
      idempotencyKey: input.idempotencyKey,
    });

    return { opportunityUuid: opportunity.uuid, created: true };
  }
}
