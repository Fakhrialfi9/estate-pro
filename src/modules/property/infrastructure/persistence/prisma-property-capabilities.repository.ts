import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  PropertyAmenityCategory,
  PropertyDocumentStatus,
  PropertyHistoryEvent,
  Prisma,
} from '../../../../../prisma/generated/prisma/client.js';
import type {
  AmenityAssignmentRecord,
  AmenityRecord,
  DocumentRecord,
  HistoryRecord,
  PropertyCapabilitiesRepository,
} from '../../domain/repositories/property-capabilities.repository.js';
import type {
  AmenityCategory,
  DocumentClassification,
  DocumentStatus,
  DocumentVisibility,
  HistoryEvent,
  SafeChange,
} from '../../domain/property-capabilities.js';

const amenityInclude = {
  amenity: true,
} satisfies Prisma.PropertyAmenityAssignmentInclude;

const mapAmenity = (row: {
  uuid: string;
  code: string;
  name: string;
  category: PropertyAmenityCategory;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}): AmenityRecord => ({
  uuid: row.uuid,
  code: row.code,
  name: row.name,
  category: row.category,
  description: row.description,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

const mapAssignment = (
  row: Prisma.PropertyAmenityAssignmentGetPayload<{
    include: typeof amenityInclude;
  }>,
): AmenityAssignmentRecord => ({
  amenity: mapAmenity(row.amenity),
  available: row.available,
  value: row.value,
  notes: row.notes,
});

const documentInclude = {
  property: { select: { uuid: true } },
  versions: { orderBy: { version: 'desc' as const } },
};

type DocumentRow = Prisma.PropertyDocumentGetPayload<{
  include: typeof documentInclude;
}>;

const mapDocument = (row: DocumentRow): DocumentRecord => ({
  uuid: row.uuid,
  propertyUuid: row.property.uuid,
  classification: row.classification,
  title: row.title,
  visibility: row.visibility,
  status: row.status,
  currentVersion: row.currentVersion,
  retentionUntil: row.retentionUntil,
  versions: row.versions.map((version) => ({
    uuid: version.uuid,
    version: version.version,
    storageProvider: version.storageProvider,
    storageKey: version.storageKey,
    mimeType: version.mimeType,
    extension: version.extension,
    fileSizeBytes: version.fileSizeBytes,
    checksumSha256: version.checksumSha256,
    createdAt: version.createdAt,
  })),
});

const safeChanges = (value: Prisma.JsonValue | null): readonly SafeChange[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const result: SafeChange[] = [];
  for (const [field, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const change = raw as Record<string, unknown>;
    const valid = (item: unknown): item is string | number | boolean | null =>
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean';
    if (valid(change.oldValue) && valid(change.newValue)) {
      result.push({
        field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      });
    }
  }
  return result;
};

const mapHistory = (row: {
  uuid: string;
  event: PropertyHistoryEvent;
  actorUuid: string | null;
  summary: string;
  changes: Prisma.JsonValue | null;
  occurredAt: Date;
}): HistoryRecord => ({
  uuid: row.uuid,
  event: row.event,
  actorUuid: row.actorUuid,
  summary: row.summary,
  changes: safeChanges(row.changes),
  occurredAt: row.occurredAt,
});

@Injectable()
export class PrismaPropertyCapabilitiesRepository
  implements PropertyCapabilitiesRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async listAmenities(activeOnly = true): Promise<AmenityRecord[]> {
    const rows = await this.prisma.propertyAmenity.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(mapAmenity);
  }

  async getAmenity(uuid: string): Promise<AmenityRecord | null> {
    const row = await this.prisma.propertyAmenity.findUnique({
      where: { uuid },
    });
    return row ? mapAmenity(row) : null;
  }

  async createAmenity(input: {
    code: string;
    name: string;
    category: AmenityCategory;
    description?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<AmenityRecord> {
    return mapAmenity(
      await this.prisma.propertyAmenity.create({
        data: {
          code: input.code,
          name: input.name,
          category: input.category,
          description: input.description ?? null,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      }),
    );
  }

  async updateAmenity(
    uuid: string,
    input: Partial<Omit<AmenityRecord, 'uuid'>>,
  ): Promise<AmenityRecord> {
    return mapAmenity(
      await this.prisma.propertyAmenity.update({
        where: { uuid },
        data: {
          code: input.code,
          name: input.name,
          category: input.category,
          description: input.description,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
      }),
    );
  }

  async deleteAmenity(uuid: string): Promise<void> {
    await this.prisma.propertyAmenity.update({
      where: { uuid },
      data: { isActive: false },
    });
  }

  private async propertyId(propertyUuid: string): Promise<bigint> {
    const property = await this.prisma.property.findFirst({
      where: { uuid: propertyUuid, deletedAt: null },
      select: { id: true },
    });
    if (!property) throw new Error('Property not found');
    return property.id;
  }

  private async amenityId(amenityUuid: string): Promise<bigint> {
    const amenity = await this.prisma.propertyAmenity.findUnique({
      where: { uuid: amenityUuid },
      select: { id: true, isActive: true },
    });
    if (!amenity || !amenity.isActive)
      throw new Error('Amenity not found or inactive');
    return amenity.id;
  }

  async listPropertyAmenities(
    propertyUuid: string,
    activeOnly = false,
  ): Promise<AmenityAssignmentRecord[]> {
    const propertyId = await this.propertyId(propertyUuid);
    const rows = await this.prisma.propertyAmenityAssignment.findMany({
      where: { propertyId, ...(activeOnly ? { available: true } : {}) },
      include: amenityInclude,
      orderBy: [
        { amenity: { sortOrder: 'asc' } },
        { amenity: { name: 'asc' } },
      ],
    });
    return rows.map(mapAssignment);
  }

  async assignAmenity(
    propertyUuid: string,
    amenityUuid: string,
    input: {
      available?: boolean;
      value?: string | null;
      notes?: string | null;
    },
  ): Promise<AmenityAssignmentRecord> {
    const [propertyId, amenityId] = await Promise.all([
      this.propertyId(propertyUuid),
      this.amenityId(amenityUuid),
    ]);
    return mapAssignment(
      await this.prisma.propertyAmenityAssignment.upsert({
        where: { propertyId_amenityId: { propertyId, amenityId } },
        update: {
          available: input.available ?? true,
          value: input.value ?? null,
          notes: input.notes ?? null,
        },
        create: {
          propertyId,
          amenityId,
          available: input.available ?? true,
          value: input.value ?? null,
          notes: input.notes ?? null,
        },
        include: amenityInclude,
      }),
    );
  }

  async unassignAmenity(
    propertyUuid: string,
    amenityUuid: string,
  ): Promise<void> {
    const [propertyId, amenityId] = await Promise.all([
      this.propertyId(propertyUuid),
      this.amenityId(amenityUuid),
    ]);
    await this.prisma.propertyAmenityAssignment.delete({
      where: { propertyId_amenityId: { propertyId, amenityId } },
    });
  }

  async listDocuments(
    propertyUuid: string,
    includeArchived = false,
  ): Promise<DocumentRecord[]> {
    const propertyId = await this.propertyId(propertyUuid);
    const rows = await this.prisma.propertyDocument.findMany({
      where: {
        propertyId,
        ...(includeArchived
          ? {}
          : {
              status: {
                notIn: ['ARCHIVED', 'DELETED'] as PropertyDocumentStatus[],
              },
            }),
      },
      include: documentInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(mapDocument);
  }

  async getDocument(
    propertyUuid: string,
    documentUuid: string,
  ): Promise<DocumentRecord | null> {
    const propertyId = await this.propertyId(propertyUuid);
    const row = await this.prisma.propertyDocument.findFirst({
      where: { uuid: documentUuid, propertyId, status: { not: 'DELETED' } },
      include: documentInclude,
    });
    return row ? mapDocument(row) : null;
  }

  async createDocument(input: {
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
  }): Promise<DocumentRecord> {
    const propertyId = await this.propertyId(input.propertyUuid);
    return mapDocument(
      await this.prisma.propertyDocument.create({
        data: {
          propertyId,
          classification: input.classification,
          title: input.title,
          visibility: input.visibility,
          status: input.status,
          currentVersion: 1,
          retentionUntil: input.retentionUntil ?? null,
          createdBy: input.actorUuid ?? null,
          updatedBy: input.actorUuid ?? null,
          versions: {
            create: {
              version: 1,
              storageProvider: input.version.storageProvider ?? null,
              storageKey: input.version.storageKey,
              mimeType: input.version.mimeType,
              extension: input.version.extension ?? null,
              fileSizeBytes: input.version.fileSizeBytes ?? null,
              checksumSha256: input.version.checksumSha256,
              createdBy: input.version.createdBy ?? input.actorUuid ?? null,
            },
          },
        },
        include: documentInclude,
      }),
    );
  }

  async createDocumentVersion(input: {
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
  }): Promise<DocumentRecord> {
    const propertyId = await this.propertyId(input.propertyUuid);
    const document = await this.prisma.propertyDocument.findFirst({
      where: {
        uuid: input.documentUuid,
        propertyId,
        status: { not: 'DELETED' },
      },
      select: { id: true, currentVersion: true },
    });
    if (!document) throw new Error('Document not found');
    const version = document.currentVersion + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.propertyDocumentVersion.create({
        data: {
          documentId: document.id,
          version,
          storageProvider: input.version.storageProvider ?? null,
          storageKey: input.version.storageKey,
          mimeType: input.version.mimeType,
          extension: input.version.extension ?? null,
          fileSizeBytes: input.version.fileSizeBytes ?? null,
          checksumSha256: input.version.checksumSha256,
          createdBy: input.version.createdBy ?? null,
        },
      });
      await tx.propertyDocument.update({
        where: { id: document.id },
        data: { currentVersion: version },
      });
    });
    return mapDocument(
      await this.prisma.propertyDocument.findUniqueOrThrow({
        where: { id: document.id },
        include: documentInclude,
      }),
    );
  }

  async updateDocument(
    propertyUuid: string,
    documentUuid: string,
    input: Partial<
      Pick<
        DocumentRecord,
        'classification' | 'title' | 'visibility' | 'status' | 'retentionUntil'
      >
    >,
    actorUuid?: string | null,
  ): Promise<DocumentRecord> {
    const propertyId = await this.propertyId(propertyUuid);
    const existing = await this.prisma.propertyDocument.findFirst({
      where: { uuid: documentUuid, propertyId, status: { not: 'DELETED' } },
      select: { id: true },
    });
    if (!existing) throw new Error('Document not found');
    const row = await this.prisma.propertyDocument.update({
      where: { id: existing.id },
      data: {
        classification: input.classification,
        title: input.title,
        visibility: input.visibility,
        status: input.status,
        retentionUntil: input.retentionUntil,
        updatedBy: actorUuid ?? null,
      },
      include: documentInclude,
    });
    return mapDocument(row);
  }

  async deleteDocument(
    propertyUuid: string,
    documentUuid: string,
    actorUuid?: string | null,
  ): Promise<void> {
    const propertyId = await this.propertyId(propertyUuid);
    await this.prisma.propertyDocument.updateMany({
      where: { uuid: documentUuid, propertyId, status: { not: 'DELETED' } },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        updatedBy: actorUuid ?? null,
      },
    });
  }

  async recordHistory(input: {
    propertyUuid: string;
    event: HistoryEvent;
    actorUuid?: string;
    summary: string;
    changes?: readonly SafeChange[];
  }): Promise<HistoryRecord> {
    const propertyId = await this.propertyId(input.propertyUuid);
    const changes = input.changes
      ? Object.fromEntries(
          input.changes.map((change) => [
            change.field,
            { oldValue: change.oldValue, newValue: change.newValue },
          ]),
        )
      : undefined;
    return mapHistory(
      await this.prisma.propertyHistory.create({
        data: {
          propertyId,
          event: input.event,
          actorUuid: input.actorUuid ?? null,
          summary: input.summary,
          changes,
        },
      }),
    );
  }

  async listHistory(
    propertyUuid: string,
    page: number,
    limit: number,
    event?: HistoryEvent,
  ): Promise<{
    items: HistoryRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const propertyId = await this.propertyId(propertyUuid);
    const where = {
      propertyId,
      ...(event ? { event } : {}),
    };
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.propertyHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.propertyHistory.count({ where }),
    ]);
    return { items: rows.map(mapHistory), total, page, limit };
  }
}
