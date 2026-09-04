import type {
  AmenityCategory,
  DocumentClassification,
  DocumentStatus,
  DocumentVisibility,
  HistoryEvent,
  SafeChange,
} from '../property-capabilities.js';

export type PropertyCapabilityActor = {
  actorUuid?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

export type AmenityRecord = {
  uuid: string;
  code: string;
  name: string;
  category: AmenityCategory;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type AmenityAssignmentRecord = {
  amenity: AmenityRecord;
  available: boolean;
  value: string | null;
  notes: string | null;
};

export type DocumentRecord = {
  uuid: string;
  propertyUuid: string;
  classification: DocumentClassification;
  title: string;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  currentVersion: number;
  retentionUntil: Date | null;
  versions: Array<{
    uuid: string;
    version: number;
    storageProvider: string | null;
    storageKey: string;
    mimeType: string;
    extension: string | null;
    fileSizeBytes: number | null;
    checksumSha256: string;
    createdAt: Date;
  }>;
};

export type HistoryRecord = {
  uuid: string;
  event: HistoryEvent;
  actorUuid: string | null;
  summary: string;
  changes: readonly SafeChange[];
  occurredAt: Date;
};

export interface PropertyCapabilitiesRepository {
  listAmenities(activeOnly?: boolean): Promise<AmenityRecord[]>;
  getAmenity(uuid: string): Promise<AmenityRecord | null>;
  createAmenity(input: {
    code: string;
    name: string;
    category: AmenityCategory;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<AmenityRecord>;
  updateAmenity(uuid: string, input: Partial<Omit<AmenityRecord, 'uuid'>>): Promise<AmenityRecord>;
  deleteAmenity(uuid: string): Promise<void>;
  listPropertyAmenities(propertyUuid: string, activeOnly?: boolean): Promise<AmenityAssignmentRecord[]>;
  assignAmenity(
    propertyUuid: string,
    amenityUuid: string,
    input: { available?: boolean; value?: string | null; notes?: string | null },
  ): Promise<AmenityAssignmentRecord>;
  unassignAmenity(propertyUuid: string, amenityUuid: string): Promise<void>;

  listDocuments(propertyUuid: string, includeArchived?: boolean): Promise<DocumentRecord[]>;
  getDocument(propertyUuid: string, documentUuid: string): Promise<DocumentRecord | null>;
  createDocument(input: {
    propertyUuid: string;
    classification: DocumentClassification;
    title: string;
    visibility: DocumentVisibility;
    status: DocumentStatus;
    retentionUntil?: Date | null;
    version: {
      storageProvider?: string | null;
      storageKey: string;
      mimeType: string;
      extension?: string | null;
      fileSizeBytes?: number | null;
      checksumSha256: string;
      createdBy?: string | null;
    };
    actorUuid?: string | null;
  }): Promise<DocumentRecord>;
  createDocumentVersion(input: {
    propertyUuid: string;
    documentUuid: string;
    version: {
      storageProvider?: string | null;
      storageKey: string;
      mimeType: string;
      extension?: string | null;
      fileSizeBytes?: number | null;
      checksumSha256: string;
      createdBy?: string | null;
    };
  }): Promise<DocumentRecord>;
  updateDocument(
    propertyUuid: string,
    documentUuid: string,
    input: Partial<Pick<DocumentRecord, 'classification' | 'title' | 'visibility' | 'status' | 'retentionUntil'>>,
    actorUuid?: string | null,
  ): Promise<DocumentRecord>;
  deleteDocument(propertyUuid: string, documentUuid: string, actorUuid?: string | null): Promise<void>;

  recordHistory(input: {
    propertyUuid: string;
    event: HistoryEvent;
    actorUuid?: string;
    summary: string;
    changes?: readonly SafeChange[];
  }): Promise<HistoryRecord>;
  listHistory(propertyUuid: string, page: number, limit: number, event?: HistoryEvent): Promise<{
    items: HistoryRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
}

export const PROPERTY_CAPABILITIES_REPOSITORY = Symbol('PROPERTY_CAPABILITIES_REPOSITORY');
