import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PropertyCapabilitiesService } from '../../../src/modules/property/application/property-capabilities.service.js';
import { PropertyCapabilityValidationError } from '../../../src/modules/property/domain/property-capabilities.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';
import type { PropertyCapabilitiesRepository } from '../../../src/modules/property/domain/repositories/property-capabilities.repository.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const actor = uuid;
const amenity = {
  uuid,
  code: 'POOL',
  name: 'Pool',
  category: 'OUTDOOR' as const,
  description: null,
  isActive: true,
  sortOrder: 1,
};
const document = {
  uuid,
  propertyUuid: uuid,
  classification: 'LEGAL' as const,
  title: 'Deed',
  visibility: 'PRIVATE' as const,
  status: 'ACTIVE' as const,
  currentVersion: 1,
  retentionUntil: null,
  versions: [],
};

describe('PropertyCapabilitiesService phase 10 coverage', () => {
  const makeRepo = () =>
    ({
      listAmenities: vi.fn<PropertyCapabilitiesRepository['listAmenities']>().mockResolvedValue([amenity]),
      getAmenity: vi.fn<PropertyCapabilitiesRepository['getAmenity']>().mockResolvedValue(amenity),
      createAmenity: vi.fn<PropertyCapabilitiesRepository['createAmenity']>().mockResolvedValue(amenity),
      updateAmenity: vi.fn<PropertyCapabilitiesRepository['updateAmenity']>().mockResolvedValue(amenity),
      deleteAmenity: vi.fn<PropertyCapabilitiesRepository['deleteAmenity']>().mockResolvedValue(undefined),
      listPropertyAmenities: vi.fn<PropertyCapabilitiesRepository['listPropertyAmenities']>().mockResolvedValue([]),
      assignAmenity: vi.fn<PropertyCapabilitiesRepository['assignAmenity']>().mockResolvedValue({
        amenity,
        available: true,
        value: null,
        notes: null,
      }),
      unassignAmenity: vi.fn<PropertyCapabilitiesRepository['unassignAmenity']>().mockResolvedValue(undefined),
      listDocuments: vi.fn<PropertyCapabilitiesRepository['listDocuments']>().mockResolvedValue([document]),
      getDocument: vi.fn<PropertyCapabilitiesRepository['getDocument']>().mockResolvedValue(document),
      createDocument: vi.fn<PropertyCapabilitiesRepository['createDocument']>().mockResolvedValue(document),
      createDocumentVersion: vi.fn<PropertyCapabilitiesRepository['createDocumentVersion']>().mockResolvedValue({ currentVersion: 2 }),
      updateDocument: vi.fn<PropertyCapabilitiesRepository['updateDocument']>().mockResolvedValue(document),
      deleteDocument: vi.fn<PropertyCapabilitiesRepository['deleteDocument']>().mockResolvedValue(undefined),
      recordHistory: vi.fn<PropertyCapabilitiesRepository['recordHistory']>().mockResolvedValue({ uuid: 'history-1' }),
      listHistory: vi.fn<PropertyCapabilitiesRepository['listHistory']>().mockResolvedValue([]),
    }) satisfies PropertyCapabilitiesRepository;

  it('covers amenity and assignment operations and validation', async () => {
    const repository = makeRepo();
    const audit = {
      record: vi.fn<SecurityAuditRepository['record']>().mockResolvedValue(undefined),
    } satisfies SecurityAuditRepository;
    const service = new PropertyCapabilitiesService(repository, audit);
    expect(await service.listAmenities()).toEqual([amenity]);
    await service.listAmenities(false);
    expect(await service.getAmenity(uuid)).toEqual(amenity);
    await service.updateAmenity(
      uuid,
      { code: ' new-code ', name: ' New Name ', description: ' Desc ' },
      actor,
    );
    await service.deleteAmenity(uuid, actor);
    await service.listPropertyAmenities(uuid, true);
    await service.assignAmenity(
      uuid,
      uuid,
      { available: true, value: 'A', notes: 'N' },
      actor,
    );
    await service.unassignAmenity(uuid, uuid, actor);
    expect(repository.updateAmenity).toHaveBeenCalledWith(
      uuid,
      expect.objectContaining({
        code: 'NEW-CODE',
        name: 'New Name',
        description: 'Desc',
      }),
    );
    await expect(
      service.createAmenity(
        { code: 'POOL', name: 'P', category: 'OUTDOOR' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateAmenity(uuid, { name: 'x'.repeat(121) }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.assignAmenity(uuid, uuid, { value: 'x'.repeat(121) }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.assignAmenity(uuid, uuid, { notes: 'x'.repeat(501) }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('covers document lifecycle, history pagination and error mapping', async () => {
    const repository = makeRepo();
    const audit = {
      record: vi.fn<SecurityAuditRepository['record']>().mockResolvedValue(undefined),
    } satisfies SecurityAuditRepository;
    const service = new PropertyCapabilitiesService(repository, audit);
    await service.listDocuments(uuid, true);
    await expect(service.getDocument(uuid, uuid)).resolves.toEqual(document);
    repository.getDocument.mockResolvedValueOnce(null);
    await expect(service.getDocument(uuid, uuid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await service.createDocument(
      uuid,
      {
        classification: 'LEGAL',
        title: ' Deed ',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        storageKey: 'docs/deed.pdf',
        mimeType: 'application/pdf',
        checksumSha256: 'A'.repeat(64),
        fileSizeBytes: 10,
      },
      actor,
    );
    await service.createDocumentVersion(
      uuid,
      uuid,
      {
        storageKey: 'docs/v2.pdf',
        mimeType: 'application/pdf',
        checksumSha256: 'B'.repeat(64),
        fileSizeBytes: 20,
      },
      actor,
    );
    await service.updateDocument(uuid, uuid, { title: ' Updated ' }, actor);
    await service.deleteDocument(uuid, uuid, actor);
    await service.createHistory(
      uuid,
      { event: 'UPDATED', summary: '  Changed  ' },
      actor,
    );
    await service.listHistory(uuid, 0.2, 500);
    expect(repository.listHistory).toHaveBeenCalledWith(
      uuid,
      1,
      100,
      undefined,
    );
    await expect(
      service.createHistory(
        uuid,
        { event: 'BAD' as never, summary: 'x' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createHistory(
        uuid,
        { event: 'UPDATED', summary: ' '.repeat(2) },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(() => service.listHistory(uuid, 1, 10, 'BAD' as never)).toThrow(
      BadRequestException,
    );

    repository.createDocument.mockRejectedValueOnce(
      new PropertyCapabilityValidationError('invalid'),
    );
    await expect(
      service.createDocument(
        uuid,
        {
          classification: 'LEGAL',
          title: 'Doc',
          visibility: 'PRIVATE',
          status: 'ACTIVE',
          storageKey: 'docs/d.pdf',
          mimeType: 'application/pdf',
          checksumSha256: 'C'.repeat(64),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.createDocument.mockRejectedValueOnce(
      new Error('duplicate document'),
    );
    await expect(
      service.createDocument(
        uuid,
        {
          classification: 'LEGAL',
          title: 'Doc',
          visibility: 'PRIVATE',
          status: 'ACTIVE',
          storageKey: 'docs/d.pdf',
          mimeType: 'application/pdf',
          checksumSha256: 'C'.repeat(64),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    repository.createDocument.mockRejectedValueOnce(
      new Error('document not found'),
    );
    await expect(
      service.createDocument(
        uuid,
        {
          classification: 'LEGAL',
          title: 'Doc',
          visibility: 'PRIVATE',
          status: 'ACTIVE',
          storageKey: 'docs/d.pdf',
          mimeType: 'application/pdf',
          checksumSha256: 'C'.repeat(64),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    repository.createDocument.mockRejectedValueOnce({ reason: 'unknown' });
    await expect(
      service.createDocument(
        uuid,
        {
          classification: 'LEGAL',
          title: 'Doc',
          visibility: 'PRIVATE',
          status: 'ACTIVE',
          storageKey: 'docs/d.pdf',
          mimeType: 'application/pdf',
          checksumSha256: 'C'.repeat(64),
        },
        actor,
      ),
    ).rejects.toThrow('Property capability operation failed');
  });
});
