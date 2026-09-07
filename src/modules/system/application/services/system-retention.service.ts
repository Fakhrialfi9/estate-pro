import { Inject, Injectable } from '@nestjs/common';
import {
  SYSTEM_RETENTION_REPOSITORY,
  type SystemRetentionRepository,
} from '../../domain/repositories/system-retention.repository.js';

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;
const MAX_BATCH_SIZE = 1000;

@Injectable()
export class SystemRetentionService {
  constructor(
    @Inject(SYSTEM_RETENTION_REPOSITORY)
    private readonly repository: SystemRetentionRepository,
  ) {}

  async run(input: {
    activityRetentionDays: number;
    auditRetentionDays: number;
    batchSize?: number;
  }) {
    const activityDays = this.days(input.activityRetentionDays);
    const auditDays = this.days(input.auditRetentionDays);
    const batchSize = Math.min(
      MAX_BATCH_SIZE,
      Math.max(1, Math.trunc(input.batchSize ?? 250)),
    );
    const now = Date.now();
    const activityBefore = new Date(now - activityDays * 24 * 60 * 60 * 1000);
    const auditBefore = new Date(now - auditDays * 24 * 60 * 60 * 1000);

    let activityDeleted = 0;
    let auditDeleted = 0;
    while (true) {
      const deleted = await this.repository.purgeActivity(
        activityBefore,
        batchSize,
      );
      activityDeleted += deleted;
      if (deleted < batchSize) break;
    }
    while (true) {
      const deleted = await this.repository.purgeAudit(auditBefore, batchSize);
      auditDeleted += deleted;
      if (deleted < batchSize) break;
    }

    return {
      activity: { retentionDays: activityDays, deleted: activityDeleted },
      audit: { retentionDays: auditDays, deleted: auditDeleted },
      batchSize,
    };
  }

  private days(value: number): number {
    const days = Math.trunc(value);
    if (
      !Number.isFinite(days) ||
      days < MIN_RETENTION_DAYS ||
      days > MAX_RETENTION_DAYS
    )
      throw new RangeError('Retention days are outside the supported range');
    return days;
  }
}
