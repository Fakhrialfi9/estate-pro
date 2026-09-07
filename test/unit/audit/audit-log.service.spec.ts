import { describe, expect, it, vi } from 'vitest';
import { AuditLogService } from '../../../src/modules/audit/application/audit-log.service.js';
import type { AuditLogRepository } from '../../../src/modules/audit/domain/repositories/audit-log.repository.js';

type AuditLogger = {
  setContext: (context: string) => void;
  error: (context: Record<string, unknown>, message: string) => void;
};

describe('AuditLogService', () => {
  it('does not propagate audit persistence failures to the business caller', async () => {
    const record = vi
      .fn<AuditLogRepository['record']>()
      .mockRejectedValue(new Error('audit database unavailable'));
    const repository: Pick<AuditLogRepository, 'record' | 'list'> = {
      record,
      list: vi.fn<AuditLogRepository['list']>(),
    };
    const logger: AuditLogger = {
      setContext: vi.fn<(context: string) => void>(),
      error: vi.fn<
        (context: Record<string, unknown>, message: string) => void
      >(),
    };
    const service = new AuditLogService(repository, logger as never);

    await expect(
      service.record({
        action: 'SYSTEM_SETTING_UPDATED',
        actorUuid: 'actor-1',
        subjectUuid: 'actor-1',
        entityType: 'system_setting',
        entityUuid: 'setting-1',
        result: 'SUCCESS',
      }),
    ).resolves.toBeUndefined();

    expect(repository.record).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        auditAction: 'SYSTEM_SETTING_UPDATED',
        resourceType: 'system_setting',
        resourceId: 'setting-1',
        error: expect.objectContaining({
          type: 'Error',
          message: 'audit database unavailable',
        }),
      }),
      expect.stringContaining('Audit write failed'),
    );
  });
});
