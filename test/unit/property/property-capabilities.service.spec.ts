import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PropertyCapabilitiesService } from '../../../src/modules/property/application/property-capabilities.service.js';
import type {
  PropertyCapabilitiesRepository,
  AmenityRecord,
  DocumentRecord,
} from '../../../src/modules/property/domain/repositories/property-capabilities.repository.js';

const actorUuid = '11111111-1111-4111-8111-111111111111';
const amenity: AmenityRecord = {
  uuid: '22222222-2222-4222-8222-222222222222',
  code: 'POOL',
  name: 'Pool',
  category: 'OUTDOOR',
  description: null,
  isActive: true,
  sortOrder: 1,
};
const document: DocumentRecord = {
  uuid: '33333333-3333-4333-8333-333333333333',
  propertyUuid: '44444444-4444-4444-8444-444444444444',
  classification: 'LEGAL',
  title: 'Deed',
  visibility: 'PRIVATE',
  status: 'ACTIVE',
  currentVersion: 1,
  retentionUntil: null,
  versions: [],
};

describe('PropertyCapabilitiesService', () => {
  const repository = {
    listAmenities: vi.fn(),
    getAmenity: vi.fn(),
    createAmenity: vi.fn(),
    updateAmenity: vi.fn(),
    deleteAmenity: vi.fn(),
    listPropertyAmenities: vi.fn(),
    assignAmenity: vi.fn(),
    unassignAmenity: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    createDocumentVersion: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    recordHistory: vi.fn(),
    listHistory: vi.fn(),
  } satisfies Record<
    keyof PropertyCapabilitiesRepository,
    ReturnType<typeof vi.fn>
  >;
  const auditRecord = vi.fn().mockResolvedValue(undefined);
  const service = new PropertyCapabilitiesService(repository, {
    record: auditRecord,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repository.createAmenity.mockResolvedValue(amenity);
    repository.updateAmenity.mockResolvedValue(amenity);
    repository.assignAmenity.mockResolvedValue({
      amenity,
      available: true,
      value: null,
      notes: null,
    });
    repository.recordHistory.mockResolvedValue({});
    repository.createDocument.mockResolvedValue(document);
  });

  it('normalizes amenity input and audits the mutation', async () => {
    await expect(
      service.createAmenity(
        {
          code: ' pool ',
          name: '  Pool  ',
          category: 'OUTDOOR',
          description: '  Swim  ',
        },
        actorUuid,
      ),
    ).resolves.toBe(amenity);
    expect(repository.createAmenity).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'POOL',
        name: 'Pool',
        description: 'Swim',
      }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ entityUuid: amenity.uuid, result: 'SUCCESS' }),
    );
  });

  it('rejects invalid amenity data before persistence', async () => {
    await expect(
      service.createAmenity(
        { code: 'bad code', name: 'A', category: 'OUTDOOR' },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createAmenity).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('maps repository uniqueness errors to conflicts', async () => {
    repository.createAmenity.mockRejectedValue(
      new Error('duplicate amenity code'),
    );
    await expect(
      service.createAmenity(
        { code: 'POOL', name: 'Pool', category: 'OUTDOOR' },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('assigns an amenity and records both audit and property history', async () => {
    const propertyUuid = '44444444-4444-4444-8444-444444444444';
    await service.assignAmenity(
      propertyUuid,
      amenity.uuid,
      { available: true, notes: '  Open  ' },
      actorUuid,
    );
    expect(repository.assignAmenity).toHaveBeenCalledWith(
      propertyUuid,
      amenity.uuid,
      { available: true, notes: '  Open  ' },
    );
    expect(repository.recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ propertyUuid, actorUuid, event: 'UPDATED' }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ entityUuid: propertyUuid }),
    );
  });

  it('normalizes document metadata and storage validation before audit/history', async () => {
    await service.createDocument(
      '44444444-4444-4444-8444-444444444444',
      {
        classification: 'LEGAL',
        title: '  Deed  ',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        storageKey: 'docs/deed.pdf',
        mimeType: 'application/pdf',
        checksumSha256: 'A'.repeat(64),
        fileSizeBytes: 10,
      },
      actorUuid,
    );
    expect(repository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Deed',
        retentionUntil: null,
        version: expect.objectContaining({
          storageKey: 'docs/deed.pdf',
          checksumSha256: 'a'.repeat(64),
          createdBy: actorUuid,
        }),
      }),
    );
    expect(repository.recordHistory).toHaveBeenCalledOnce();
    expect(auditRecord).toHaveBeenCalledOnce();
  });

  it('returns not-found for missing documents and clamps history pagination', async () => {
    repository.getDocument.mockResolvedValue(null);
    await expect(service.getDocument('p', 'd')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await service.listHistory('p', 0.5, 500);
    expect(repository.listHistory).toHaveBeenCalledWith('p', 1, 100, undefined);
  });
});
