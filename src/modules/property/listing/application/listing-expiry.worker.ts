import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { LISTING_REPOSITORY } from '../domain/listing.repository.js';
import type {
  ListingActor,
  ListingRepository,
} from '../domain/listing.repository.js';

const LISTING_EXPIRY_INTERVAL_MS = 60_000;
const SYSTEM_ACTOR: ListingActor = {};

@Injectable()
export class ListingExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly repository: ListingRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}
  onModuleInit(): void {
    void this.expireDue();
    this.timer = setInterval(
      () => void this.expireDue(),
      LISTING_EXPIRY_INTERVAL_MS,
    );
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  private async expireDue(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.repository.expireDue(SYSTEM_ACTOR);
      for (const uuid of expired)
        await this.audit.record({
          action: 'property.listing.expired',
          actorType: 'SYSTEM',
          entityType: 'property_listing',
          entityUuid: uuid,
          result: 'SUCCESS',
          system: true,
        });
    } finally {
      this.running = false;
    }
  }
}
