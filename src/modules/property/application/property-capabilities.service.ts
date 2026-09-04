import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AUDIT_ACTIONS } from '../../../common/audit/audit-events.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import {
  AMENITY_CATEGORIES,
  DOCUMENT_CLASSIFICATIONS,
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  HISTORY_EVENTS,
  PropertyCapabilityValidationError,
  type AmenityCategory,
  type DocumentClassification,
  type DocumentStatus,
  type DocumentVisibility,
  type HistoryEvent,
  validateAmenityCode,
  validateDocumentChecksum,
  validateDocumentStorageKey,
} from '../domain/property-capabilities.js';
import { PROPERTY_CAPABILITIES_REPOSITORY } from '../domain/repositories/property-capabilities.repository.js';
import type { PropertyCapabilitiesRepository } from '../domain/repositories/property-capabilities.repository.js';

const scalar = (
  value: unknown,
): string | number | boolean | null | undefined =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'
    ? value
    : undefined;

@Injectable()
export class PropertyCapabilitiesService {
  constructor(
    @Inject(PROPERTY_CAPABILITIES_REPOSITORY)
    private readonly repository: PropertyCapabilitiesRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  listAmenities(activeOnly = true) {
    return this.repository.listAmenities(activeOnly);
  }

  async createAmenity(
    input: {
      code: string;
      name: string;
      category: AmenityCategory;
      description?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    },
    actorUuid: string,
  ) {
    try {
      validateAmenityCode(input.code);
      if (input.name.trim().length < 2 || input.name.trim().length > 120)
        throw new BadRequestException('Invalid amenity name');
      if (!AMENITY_CATEGORIES.includes(input.category))
        throw new BadRequestException('Invalid amenity category');
      const result = await this.repository.createAmenity({
        ...input,
        code: validateAmenityCode(input.code),
        name: input.name.trim(),
        description: input.description?.trim() ?? input.description,
      });
      await this.auditMutation(input, result.uuid, actorUuid);
      return result;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async updateAmenity(
    uuid: string,
    input: {
      code?: string;
      name?: string;
      category?: AmenityCategory;
      description?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    },
    actorUuid: string,
  ) {
    try {
      if (input.code !== undefined)
        input.code = validateAmenityCode(input.code);
      if (
        input.name !== undefined &&
        (input.name.trim().length < 2 || input.name.trim().length > 120)
      )
        throw new BadRequestException('Invalid amenity name');
      if (
        input.category !== undefined &&
        !AMENITY_CATEGORIES.includes(input.category)
      )
        throw new BadRequestException('Invalid amenity category');
      const result = await this.repository.updateAmenity(uuid, {
        ...input,
        name: input.name?.trim(),
        description: input.description?.trim() ?? input.description,
      });
      await this.auditMutation(input, uuid, actorUuid);
      return result;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async deleteAmenity(uuid: string, actorUuid: string) {
    try {
      await this.repository.deleteAmenity(uuid);
      await this.auditMutation(
        { operation: 'amenity.deactivate' },
        uuid,
        actorUuid,
      );
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  listPropertyAmenities(propertyUuid: string, activeOnly = false) {
    return this.repository.listPropertyAmenities(propertyUuid, activeOnly);
  }

  async assignAmenity(
    propertyUuid: string,
    amenityUuid: string,
    input: {
      available?: boolean;
      value?: string | null;
      notes?: string | null;
    },
    actorUuid: string,
  ) {
    try {
      if (input.value != null && input.value.length > 120)
        throw new BadRequestException('Amenity value is too long');
      if (input.notes != null && input.notes.length > 500)
        throw new BadRequestException('Amenity notes are too long');
      const result = await this.repository.assignAmenity(
        propertyUuid,
        amenityUuid,
        input,
      );
      await this.auditMutation(
        { operation: 'amenity.assign', amenityUuid },
        propertyUuid,
        actorUuid,
      );
      await this.repository.recordHistory({
        propertyUuid,
        event: 'UPDATED',
        actorUuid,
        summary: 'Property amenity assignment changed',
        changes: [{ field: 'amenity', oldValue: null, newValue: amenityUuid }],
      });
      return result;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async unassignAmenity(
    propertyUuid: string,
    amenityUuid: string,
    actorUuid: string,
  ) {
    try {
      await this.repository.unassignAmenity(propertyUuid, amenityUuid);
      await this.auditMutation(
        { operation: 'amenity.unassign', amenityUuid },
        propertyUuid,
        actorUuid,
      );
      await this.repository.recordHistory({
        propertyUuid,
        event: 'UPDATED',
        actorUuid,
        summary: 'Property amenity assignment removed',
        changes: [{ field: 'amenity', oldValue: amenityUuid, newValue: null }],
      });
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  listDocuments(propertyUuid: string, includeArchived = false) {
    return this.repository.listDocuments(propertyUuid, includeArchived);
  }
  async getDocument(propertyUuid: string, documentUuid: string) {
    const document = await this.repository.getDocument(
      propertyUuid,
      documentUuid,
    );
    if (!document) throw new NotFoundException('Property document not found');
    return document;
  }

  async createDocument(
    propertyUuid: string,
    input: {
      classification: DocumentClassification;
      title: string;
      visibility: DocumentVisibility;
      status: DocumentStatus;
      retentionUntil?: string | null;
      storageProvider?: string | null;
      storageKey: string;
      mimeType: string;
      extension?: string | null;
      fileSizeBytes?: number | null;
      checksumSha256: string;
    },
    actorUuid: string,
  ) {
    try {
      this.validateDocument(input);
      const result = await this.repository.createDocument({
        propertyUuid,
        classification: input.classification,
        title: input.title.trim(),
        visibility: input.visibility,
        status: input.status,
        retentionUntil: input.retentionUntil
          ? new Date(input.retentionUntil)
          : null,
        version: {
          storageProvider: input.storageProvider ?? null,
          storageKey: validateDocumentStorageKey(input.storageKey),
          mimeType: input.mimeType,
          extension: input.extension,
          fileSizeBytes: input.fileSizeBytes,
          checksumSha256: validateDocumentChecksum(input.checksumSha256),
          createdBy: actorUuid,
        },
        actorUuid,
      });
      await this.auditMutation(
        {
          operation: 'document.create',
          documentUuid: result.uuid,
          classification: result.classification,
        },
        propertyUuid,
        actorUuid,
      );
      await this.repository.recordHistory({
        propertyUuid,
        event: 'UPDATED',
        actorUuid,
        summary: `Document ${result.title} created`,
        changes: [{ field: 'document', oldValue: null, newValue: result.uuid }],
      });
      return result;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async createDocumentVersion(
    propertyUuid: string,
    documentUuid: string,
    input: {
      storageProvider?: string | null;
      storageKey: string;
      mimeType: string;
      extension?: string | null;
      fileSizeBytes?: number | null;
      checksumSha256: string;
    },
    actorUuid: string,
  ) {
    try {
      this.validateVersion(input);
      const result = await this.repository.createDocumentVersion({
        propertyUuid,
        documentUuid,
        version: {
          ...input,
          storageKey: validateDocumentStorageKey(input.storageKey),
          checksumSha256: validateDocumentChecksum(input.checksumSha256),
          createdBy: actorUuid,
        },
      });
      await this.auditMutation(
        {
          operation: 'document.version.create',
          documentUuid,
          version: result.currentVersion,
        },
        propertyUuid,
        actorUuid,
      );
      await this.repository.recordHistory({
        propertyUuid,
        event: 'UPDATED',
        actorUuid,
        summary: `Document ${documentUuid} version ${result.currentVersion} created`,
        changes: [
          {
            field: 'documentVersion',
            oldValue: result.currentVersion - 1,
            newValue: result.currentVersion,
          },
        ],
      });
      return result;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async updateDocument(
    propertyUuid: string,
    documentUuid: string,
    input: {
      classification?: DocumentClassification;
      title?: string;
      visibility?: DocumentVisibility;
      status?: DocumentStatus;
      retentionUntil?: string | null;
    },
    actorUuid: string,
  ) {
    try {
      if (
        input.title !== undefined &&
        (input.title.trim().length < 2 || input.title.trim().length > 200)
      )
        throw new BadRequestException('Invalid document title');
      if (
        input.classification !== undefined &&
        !DOCUMENT_CLASSIFICATIONS.includes(input.classification)
      )
        throw new BadRequestException('Invalid document classification');
      if (
        input.visibility !== undefined &&
        !DOCUMENT_VISIBILITIES.includes(input.visibility)
      )
        throw new BadRequestException('Invalid document visibility');
      if (
        input.status !== undefined &&
        !DOCUMENT_STATUSES.includes(input.status)
      )
        throw new BadRequestException('Invalid document status');
      const result = await this.repository.updateDocument(
        propertyUuid,
        documentUuid,
        {
          ...input,
          title: input.title?.trim(),
          retentionUntil: input.retentionUntil
            ? new Date(input.retentionUntil)
            : input.retentionUntil,
        },
        actorUuid,
      );
      await this.auditMutation(
        { operation: 'document.update', documentUuid },
        propertyUuid,
        actorUuid,
      );
      await this.repository.recordHistory({
        propertyUuid,
        event: 'UPDATED',
        actorUuid,
        summary: `Document ${documentUuid} metadata updated`,
        changes: [
          { field: 'document', oldValue: null, newValue: documentUuid },
        ],
      });
      return result;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async deleteDocument(
    propertyUuid: string,
    documentUuid: string,
    actorUuid: string,
  ) {
    try {
      await this.repository.deleteDocument(
        propertyUuid,
        documentUuid,
        actorUuid,
      );
      await this.auditMutation(
        { operation: 'document.delete', documentUuid },
        propertyUuid,
        actorUuid,
      );
      await this.repository.recordHistory({
        propertyUuid,
        event: 'UPDATED',
        actorUuid,
        summary: `Document ${documentUuid} deleted`,
        changes: [
          { field: 'documentStatus', oldValue: 'ACTIVE', newValue: 'DELETED' },
        ],
      });
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async createHistory(
    propertyUuid: string,
    input: {
      event: HistoryEvent;
      summary: string;
      changes?: Array<{
        field: string;
        oldValue: string | number | boolean | null;
        newValue: string | number | boolean | null;
      }>;
    },
    actorUuid: string,
  ) {
    if (!HISTORY_EVENTS.includes(input.event))
      throw new BadRequestException('Invalid history event');
    if (!input.summary.trim() || input.summary.length > 255)
      throw new BadRequestException('Invalid history summary');
    try {
      return await this.repository.recordHistory({
        propertyUuid,
        event: input.event,
        summary: input.summary.trim(),
        changes: input.changes,
        actorUuid,
      });
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  listHistory(
    propertyUuid: string,
    page = 1,
    limit = 20,
    event?: HistoryEvent,
  ) {
    if (event && !HISTORY_EVENTS.includes(event))
      throw new BadRequestException('Invalid history event');
    return this.repository.listHistory(
      propertyUuid,
      Math.max(1, Math.floor(page)),
      Math.min(100, Math.max(1, Math.floor(limit))),
      event,
    );
  }

  private validateDocument(input: {
    classification: DocumentClassification;
    title: string;
    visibility: DocumentVisibility;
    status: DocumentStatus;
    retentionUntil?: string | null;
    mimeType: string;
    storageKey: string;
    checksumSha256: string;
    fileSizeBytes?: number | null;
  }) {
    if (
      !DOCUMENT_CLASSIFICATIONS.includes(input.classification) ||
      !DOCUMENT_VISIBILITIES.includes(input.visibility) ||
      !DOCUMENT_STATUSES.includes(input.status)
    )
      throw new BadRequestException(
        'Invalid document classification, visibility, or status',
      );
    if (input.title.trim().length < 2 || input.title.trim().length > 200)
      throw new BadRequestException('Invalid document title');
    this.validateVersion(input);
    if (
      input.retentionUntil &&
      Number.isNaN(new Date(input.retentionUntil).getTime())
    )
      throw new BadRequestException('Invalid retention date');
  }

  private validateVersion(input: {
    storageKey: string;
    mimeType: string;
    checksumSha256: string;
    fileSizeBytes?: number | null;
  }) {
    validateDocumentStorageKey(input.storageKey);
    if (
      !/^[\w.+-]+\/[\w.+-]+$/.test(input.mimeType) ||
      input.mimeType.length > 120
    )
      throw new BadRequestException('Invalid MIME type');
    validateDocumentChecksum(input.checksumSha256);
    if (
      input.fileSizeBytes != null &&
      (!Number.isInteger(input.fileSizeBytes) ||
        input.fileSizeBytes < 1 ||
        input.fileSizeBytes > 4294967295)
    )
      throw new BadRequestException('Invalid file size');
  }

  private async auditMutation(
    changes: Record<string, unknown>,
    entityUuid: string,
    actorUuid: string,
  ) {
    await this.audit.record({
      action: AUDIT_ACTIONS.PROPERTY_UPDATED,
      actorUuid,
      subjectUuid: actorUuid,
      actorType: 'AUTHENTICATED',
      entityType: 'property',
      entityUuid,
      result: 'SUCCESS',
      changes: Object.entries(changes).flatMap(([field, value]) => {
        const next = scalar(value);
        return next === undefined
          ? []
          : [{ field, oldValue: null, newValue: next }];
      }),
    });
  }

  private mapError(error: unknown): Error {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    )
      return error;
    if (error instanceof PropertyCapabilityValidationError)
      return new BadRequestException(error.message);
    if (
      error instanceof Error &&
      /unique|duplicate|in use/i.test(error.message)
    )
      return new ConflictException(error.message);
    if (error instanceof Error && /not found/i.test(error.message))
      return new NotFoundException(error.message);
    return error instanceof Error
      ? error
      : new Error('Property capability operation failed');
  }
}
