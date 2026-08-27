import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PropertyLifecycleService } from '../../../src/modules/property/application/property-lifecycle.service.js';
import type { PropertyLifecycleRepository } from '../../../src/modules/property/domain/repositories/property-lifecycle.repository.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';
import { MasterConcurrencyError } from '../../../src/modules/property/domain/errors.js';

const actor = {
  actorUuid: '11111111-1111-4111-8111-111111111111',
  ipAddress: '127.0.0.1',
  userAgent: 'unit-test',
  requestId: 'req-lifecycle-1',
};

describe('PropertyLifecycleService', () => {
  const repository: PropertyLifecycleRepository = {
    verify: vi.fn(),
    publish: vi.fn(),
  };
  const audit: SecurityAuditRepository = { record: vi.fn() };
  const service = new PropertyLifecycleService(repository, audit);

  beforeEach(() => vi.clearAllMocks());

  it('verifies an IN_REVIEW property and audits the transition', async () => {
    vi.mocked(repository.verify).mockResolvedValueOnce({
      uuid: '22222222-2222-4222-8222-222222222222',
      status: 'IN_REVIEW',
      verifiedAt: new Date('2026-08-28T00:00:00.000Z'),
    });

    const result = await service.verify(
      '22222222-2222-4222-8222-222222222222',
      1,
      actor,
    );

    expect(result.status).toBe('IN_REVIEW');
    expect(repository.verify).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      1,
      actor,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROPERTY_VERIFIED',
        entityType: 'property',
        entityUuid: '22222222-2222-4222-8222-222222222222',
        requestId: actor.requestId,
      }),
    );
  });

  it('publishes only an already verified IN_REVIEW property', async () => {
    vi.mocked(repository.publish).mockResolvedValueOnce({
      uuid: '33333333-3333-4333-8333-333333333333',
      status: 'ACTIVE',
      publishedAt: new Date('2026-08-28T00:00:00.000Z'),
    });

    await expect(
      service.publish('33333333-3333-4333-8333-333333333333', 2, actor),
    ).resolves.toMatchObject({ status: 'ACTIVE' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROPERTY_PUBLISHED' }),
    );
  });

  it('rejects a repository result that violates the ACTIVE publication contract', async () => {
    vi.mocked(repository.publish).mockResolvedValueOnce({
      uuid: '44444444-4444-4444-8444-444444444444',
      status: 'DRAFT',
    });

    await expect(
      service.publish('44444444-4444-4444-8444-444444444444', 1, actor),
    ).rejects.toThrow(BadRequestException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('maps optimistic concurrency failures to HTTP 409', async () => {
    vi.mocked(repository.verify).mockRejectedValueOnce(
      new MasterConcurrencyError('Property version conflict'),
    );

    await expect(
      service.verify('55555555-5555-4555-8555-555555555555', 2, actor),
    ).rejects.toThrow(ConflictException);
  });
});
