import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SystemRetentionService } from '../../../src/modules/system/application/services/system-retention.service.js';

describe('SystemRetentionService', () => {
  const createService = () => {
    const repository = {
      purgeActivity: vi.fn().mockResolvedValue(0),
      purgeAudit: vi.fn().mockResolvedValue(0),
      setActivityHold: vi.fn().mockResolvedValue(true),
      setAuditHold: vi.fn().mockResolvedValue(true),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    return {
      service: new SystemRetentionService(repository, audit),
      repository,
      audit,
    };
  };

  it('purges in bounded batches', async () => {
    const { service, repository } = createService();
    repository.purgeActivity.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    repository.purgeAudit.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    const result = await service.run({
      activityRetentionDays: 30,
      auditRetentionDays: 365,
      batchSize: 2,
    });

    expect(result).toEqual({
      activity: { retentionDays: 30, deleted: 3 },
      audit: { retentionDays: 365, deleted: 2 },
      batchSize: 2,
    });
    expect(repository.purgeActivity).toHaveBeenCalledTimes(2);
    expect(repository.purgeAudit).toHaveBeenCalledTimes(2);
  });

  it('rejects retention values outside the allowed range', async () => {
    const { service } = createService();
    await expect(
      service.run({ activityRetentionDays: 0, auditRetentionDays: 30 }),
    ).rejects.toThrow(RangeError);
    await expect(
      service.run({ activityRetentionDays: 30, auditRetentionDays: 4000 }),
    ).rejects.toThrow(RangeError);
  });

  it('sets an activity hold with a future expiry and audits the action', async () => {
    const { service, repository, audit } = createService();
    const until = new Date(Date.now() + 60_000);

    await expect(
      service.setActivityHold('actor-1', 'activity-1', true, until),
    ).resolves.toEqual({ held: true, holdUntil: until.toISOString() });
    expect(repository.setActivityHold).toHaveBeenCalledWith(
      'activity-1',
      true,
      until,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SYSTEM_SETTING_UPDATED',
        actorUuid: 'actor-1',
      }),
    );
  });

  it('rejects enabled hold without a future expiry', async () => {
    const { service } = createService();
    await expect(
      service.setAuditHold('actor-1', 'audit-1', true),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.setAuditHold(
        'actor-1',
        'audit-1',
        true,
        new Date(Date.now() - 1),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps missing held records to not found', async () => {
    const { service, repository } = createService();
    repository.setAuditHold.mockResolvedValue(false);
    await expect(
      service.setAuditHold('actor-1', 'missing', false),
    ).rejects.toThrow(NotFoundException);
  });
});
