import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  const auditRecordMock = vi.fn();
  const createPropertyMock = vi.fn();
  const getPropertyMock = vi.fn();
  const updatePropertyMock = vi.fn();
  const deletePropertyMock = vi.fn();
  const restorePropertyMock = vi.fn();
  const duplicatePropertyMock = vi.fn();

  const audit: SecurityAuditRepository = { record: auditRecordMock };

  const repository = {
    createProperty: createPropertyMock,
    getProperty: getPropertyMock,
    updateProperty: updatePropertyMock,
    deleteProperty: deletePropertyMock,
    restoreProperty: restorePropertyMock,
    duplicateProperty: duplicatePropertyMock,
  } as unknown as PropertyMasterRepository;

  const service = new PropertyMasterService(repository, audit);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records property creation with actor and safe lifecycle fields', async () => {
    createPropertyMock.mockResolvedValueOnce({
      uuid: '22222222-2222-4222-8222-222222222222',
      title: 'Villa',
      status: 'DRAFT',
      password: 'must-never-be-audited',
    });

    await service.createProperty({ title: 'Villa' }, actor);

    expect(auditRecordMock).toHaveBeenCalledWith(
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
    const uuid = '33333333-3333-4333-8333-333333333333';
    getPropertyMock
      .mockResolvedValueOnce({
        uuid,
        title: 'Villa',
        status: 'IN_REVIEW',
        version: 1,
      })
      .mockResolvedValueOnce({
        uuid,
        title: 'Villa Prime',
        status: 'IN_REVIEW',
        version: 2,
      })
      .mockResolvedValueOnce({
        uuid,
        title: 'Villa Prime',
        status: 'IN_REVIEW',
        version: 3,
        verifiedAt: new Date('2026-08-27T01:00:00.000Z'),
      });
    updatePropertyMock
      .mockResolvedValueOnce({
        uuid,
        title: 'Villa Prime',
        status: 'IN_REVIEW',
        version: 2,
      })
      .mockResolvedValueOnce({
        uuid,
        title: 'Villa Prime',
        status: 'IN_REVIEW',
        version: 3,
        verifiedAt: new Date('2026-08-27T01:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        uuid,
        title: 'Villa Prime',
        status: 'ACTIVE',
        version: 4,
      });

    await service.updateProperty(uuid, 1, { title: 'Villa Prime' }, actor);
    await service.verifyProperty(uuid, 2, actor);
    await service.publishProperty(uuid, 3, actor);

    const actions = auditRecordMock.mock.calls.map(
      ([event]: [{ action: string }]) => event.action,
    );
    expect(actions).toEqual([
      'PROPERTY_UPDATED',
      'PROPERTY_VERIFIED',
      'PROPERTY_PUBLISHED',
    ]);
  });

  it('records delete, restore, archive, and duplicate lifecycle events', async () => {
    const uuid = '44444444-4444-4444-8444-444444444444';
    deletePropertyMock.mockResolvedValueOnce();
    restorePropertyMock.mockResolvedValueOnce({ uuid });
    duplicatePropertyMock.mockResolvedValueOnce({
      uuid: '55555555-5555-4555-8555-555555555555',
    });
    getPropertyMock.mockResolvedValueOnce({
      uuid,
      status: 'ACTIVE',
      title: 'Villa',
      version: 1,
    });
    updatePropertyMock.mockResolvedValueOnce({
      uuid,
      title: 'Villa',
      status: 'ARCHIVED',
      version: 2,
    });

    await service.updateProperty(uuid, 1, { status: 'ARCHIVED' }, actor);
    await service.deleteProperty(uuid, actor);
    await service.restoreProperty(uuid, actor);
    await service.duplicateProperty(uuid, actor);

    const actions = auditRecordMock.mock.calls.map(
      ([event]: [{ action: string }]) => event.action,
    );
    expect(actions).toContain('PROPERTY_ARCHIVED');
    expect(actions).toContain('PROPERTY_DELETED');
    expect(actions).toContain('PROPERTY_RESTORED');
    expect(actions).toContain('PROPERTY_DUPLICATED');
  });
});
