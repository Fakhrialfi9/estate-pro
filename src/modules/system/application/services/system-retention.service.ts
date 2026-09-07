import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
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
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
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

  async setActivityHold(
    actorUuid: string,
    uuid: string,
    enabled: boolean,
    until?: Date,
  ): Promise<{ held: boolean; holdUntil: string | null }> {
    const holdUntil = this.normalizeHoldUntil(enabled, until);
    const updated = await this.repository.setActivityHold(
      uuid,
      enabled,
      holdUntil,
    );
    if (!updated) throw new NotFoundException('Activity record not found');
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_setting',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: `activity_retention_hold=${enabled};until=${holdUntil?.toISOString() ?? 'none'}`,
    });
    return { held: enabled, holdUntil: holdUntil?.toISOString() ?? null };
  }

  async setAuditHold(
    actorUuid: string,
    uuid: string,
    enabled: boolean,
    until?: Date,
  ): Promise<{ held: boolean; holdUntil: string | null }> {
    const holdUntil = this.normalizeHoldUntil(enabled, until);
    const updated = await this.repository.setAuditHold(
      uuid,
      enabled,
      holdUntil,
    );
    if (!updated) throw new NotFoundException('Audit record not found');
    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_setting',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: `audit_retention_hold=${enabled};until=${holdUntil?.toISOString() ?? 'none'}`,
    });
    return { held: enabled, holdUntil: holdUntil?.toISOString() ?? null };
  }

  private normalizeHoldUntil(enabled: boolean, until?: Date): Date | null {
    if (!enabled) return null;
    if (!until || !Number.isFinite(until.getTime()))
      throw new BadRequestException('Retention hold expiry is required');
    if (until.getTime() <= Date.now())
      throw new BadRequestException(
        'Retention hold expiry must be in the future',
      );
    return until;
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
