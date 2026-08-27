import { describe, expect, it, vi } from 'vitest';
import { PropertyMasterService } from '../../../src/modules/property/application/property-master.service.js';
import type { PropertyMasterRepository } from '../../../src/modules/property/domain/repositories/property-master.repository.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';

describe('PropertyMasterService audit lifecycle', () => {
  const actor = {
    actorUuid: '11111111-1111-4111-8111-111111111111',
    requestId: 'req-123',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };
  const audit: SecurityAuditRepository = { record: vi.fn() };

  const repository = {
    createProperty: vi.fn(),
    getProperty: vi.fn(),
    updateProperty: vi.fn(),
    deleteProperty: vi.fn(),
    restoreProperty: vi.fn(),
    duplicateProperty: vi.fn(),
  } as unknown as PropertyMasterRepository;

  const service = new PropertyMasterService(repository, audit);

  it('records property creation with actor and safe lifecycle fields', async () => {
    vi.mocked(repository.createProperty).mockResolvedValueOnce({
      uuid: '22222222-2222-4222-8222-222222222222',
      title: 'Villa',
      status: 'DRAFT',
      password: 'must-never-be-audited',
    });

    await service.createProperty({ title: 'Villa' }, actor);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROPERTY_CREATED',
        entityType: 'property',
        entityUuid: '22222222-2222-4222-8222-222222222222',
        actorUuid: actor.actorUuid,
        requestId: actor.requestId,
        result: 'SUCCESS',
        changes: [
          { field: 'title', oldValue: null, newValue: 'Villa' },
          { field: 'status', oldValue: null, newValue: 'DRAFT' },
        ],
      }),
    );
  });

  it('records update plus verification and publication transitions', async () => {
    vi.mocked(repository.getProperty).mockResolvedValueOnce({
      uuid: '33333333-3333-4333-8333-333333333333',
      title: 'Villa',
      status: 'IN_REVIEW',
      version: 1,
    });
    vi.mocked(repository.updateProperty).mockResolvedValueOnce({
      uuid: '33333333-3333-4333-8333-333333333333',
      title: 'Villa Prime',
      status: 'ACTIVE',
      version: 2,
    });

    await service.updateProperty(
      '33333333-3333-4333-8333-333333333333',
      1,
      { title: 'Villa Prime', status: 'ACTIVE' },
      actor,
    );

    const actions = vi
      .mocked(audit.record)
      .mock.calls.map(([event]) => event.action);
    expect(actions).toEqual([
      'PROPERTY_UPDATED',
      'PROPERTY_PUBLISHED',
      'PROPERTY_VERIFIED',
    ]);
  });

  it('records delete, restore, archive, and duplicate lifecycle events', async () => {
    const uuid = '44444444-4444-4444-8444-444444444444';
    vi.mocked(repository.deleteProperty).mockResolvedValueOnce();
    vi.mocked(repository.restoreProperty).mockResolvedValueOnce({ uuid });
    vi.mocked(repository.duplicateProperty).mockResolvedValueOnce({
      uuid: '55555555-5555-4555-8555-555555555555',
    });
    vi.mocked(repository.getProperty)
      .mockResolvedValueOnce({ uuid, status: 'ACTIVE', title: 'Villa', version: 1 })
      .mockResolvedValueOnce({ uuid, status: 'ACTIVE', title: 'Villa', version: 1 });
    vi.mocked(repository.updateProperty).mockResolvedValueOnce({
      uuid,
      title: 'Villa',
      status: 'ARCHIVED',
      version: 2,
    });

    await service.updateProperty(uuid, 1, { status: 'ARCHIVED' }, actor);
    await service.deleteProperty(uuid, actor);
    await service.restoreProperty(uuid, actor);
    await service.duplicateProperty(uuid, actor);

    const actions = vi
      .mocked(audit.record)
      .mock.calls.map(([event]) => event.action);
    expect(actions).toContain('PROPERTY_ARCHIVED');
    expect(actions).toContain('PROPERTY_DELETED');
    expect(actions).toContain('PROPERTY_RESTORED');
    expect(actions).toContain('PROPERTY_DUPLICATED');
  });
});
