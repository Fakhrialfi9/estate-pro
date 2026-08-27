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
  assertAvailability,
  assertTransition,
  type ActorContext,
  type FacilityCategory,
  type PageRequest,
  type PropertyStatus,
} from '../domain/property-master.types.js';
import type { PropertyMasterRepository } from '../domain/repositories/property-master.repository.js';
import { PROPERTY_MASTER_REPOSITORY } from '../domain/repositories/property-master.repository.js';
import {
  MasterConcurrencyError,
  MasterConflictError,
  MasterHierarchyError,
  MasterInUseError,
  MasterNotFoundError,
  MasterStateError,
} from '../domain/errors.js';

const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toStatus = (value: unknown, fallback: PropertyStatus): PropertyStatus =>
  typeof value === 'string' ? (value as PropertyStatus) : fallback;

const auditScalar = (
  value: unknown,
): string | boolean | number | null | undefined => {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return value;
  return undefined;
};

const diff = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): readonly SecurityAuditChange[] => {
  const fields = [
    'businessCode',
    'referenceNumber',
    'title',
    'slug',
    'shortDescription',
    'status',
    'availabilityStatus',
    'availableFrom',
    'availableTo',
    'version',
    'verifiedAt',
    'publishedAt',
  ] as const;
  return fields.flatMap((field) => {
    const oldValue = auditScalar(before[field]);
    const newValue = auditScalar(after[field]);
    if (
      oldValue === undefined ||
      newValue === undefined ||
      oldValue === newValue
    )
      return [];
    return [{ field, oldValue, newValue }];
  });
};

@Injectable()
export class PropertyMasterService {
  constructor(
    @Inject(PROPERTY_MASTER_REPOSITORY)
    private readonly repository: PropertyMasterRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  createCategory(
    input: {
      typeUuid: string;
      code: string;
      name: string;
      slug: string;
      description?: string;
      icon?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    actor: ActorContext,
  ) {
    return this.run(() => this.repository.createCategory(input, actor));
  }
  updateCategory(
    uuid: string,
    version: number | undefined,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ) {
    return this.run(() =>
      this.repository.updateCategory(uuid, version ?? 1, patch, actor),
    );
  }
  getCategory(uuid: string) {
    return this.run(() => this.repository.getCategory(uuid));
  }
  listCategories(
    query: PageRequest & { isActive?: boolean; typeUuid?: string },
  ) {
    return this.repository.listCategories(query);
  }
  deleteCategory(uuid: string, actor: ActorContext) {
    return this.run(() => this.repository.deleteCategory(uuid, actor));
  }
  createSubcategory(
    input: {
      categoryUuid: string;
      code: string;
      name: string;
      slug: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    actor: ActorContext,
  ) {
    return this.run(() => this.repository.createSubcategory(input, actor));
  }
  updateSubcategory(
    uuid: string,
    version: number | undefined,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ) {
    return this.run(() =>
      this.repository.updateSubcategory(uuid, version ?? 1, patch, actor),
    );
  }
  getSubcategory(uuid: string) {
    return this.run(() => this.repository.getSubcategory(uuid));
  }
  listSubcategories(
    query: PageRequest & { isActive?: boolean; categoryUuid?: string },
  ) {
    return this.repository.listSubcategories(query);
  }
  deleteSubcategory(uuid: string, actor: ActorContext) {
    return this.run(() => this.repository.deleteSubcategory(uuid, actor));
  }
  createLocation(
    level: 'country' | 'province' | 'city' | 'district' | 'subdistrict',
    input: Record<string, unknown>,
    actor: ActorContext,
  ) {
    return this.run(() => this.repository.createLocation(level, input, actor));
  }
  updateLocation(
    level: string,
    uuid: string,
    version: number | undefined,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ) {
    return this.run(() =>
      this.repository.updateLocation(level, uuid, version ?? 1, patch, actor),
    );
  }
  getLocation(level: string, uuid: string) {
    return this.run(() => this.repository.getLocation(level, uuid));
  }
  listLocations(
    level: string,
    query: PageRequest & { isActive?: boolean; parentUuid?: string },
  ) {
    return this.repository.listLocations(level, query);
  }
  deleteLocation(level: string, uuid: string, actor: ActorContext) {
    return this.run(() => this.repository.deleteLocation(level, uuid, actor));
  }
  children(level: string, uuid: string) {
    return this.run(() => this.repository.children(level, uuid));
  }
  createFacility(
    input: {
      code: string;
      name: string;
      slug: string;
      category: FacilityCategory;
      icon?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
    actor: ActorContext,
  ) {
    return this.run(() => this.repository.createFacility(input, actor));
  }
  updateFacility(
    uuid: string,
    version: number | undefined,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ) {
    return this.run(() =>
      this.repository.updateFacility(uuid, version ?? 1, patch, actor),
    );
  }
  getFacility(uuid: string) {
    return this.run(() => this.repository.getFacility(uuid));
  }
  listFacilities(
    query: PageRequest & { isActive?: boolean; category?: FacilityCategory },
  ) {
    return this.repository.listFacilities(query);
  }
  deleteFacility(uuid: string, actor: ActorContext) {
    return this.run(() => this.repository.deleteFacility(uuid, actor));
  }

  async createProperty(input: Record<string, unknown>, actor: ActorContext) {
    assertAvailability(toDate(input.availableFrom), toDate(input.availableTo));
    const result = await this.run(() =>
      this.repository.createProperty(input, actor),
    );
    const record = result as Record<string, unknown>;
    await this.recordAudit(AUDIT_ACTIONS.PROPERTY_CREATED, record.uuid, actor, [
      {
        field: 'title',
        oldValue: null,
        newValue: auditScalar(record.title) ?? null,
      },
      {
        field: 'status',
        oldValue: null,
        newValue: auditScalar(record.status) ?? null,
      },
    ]);
    return result;
  }

  getProperty(uuid: string) {
    return this.run(() => this.repository.getProperty(uuid));
  }
  listProperties(
    query: PageRequest & {
      status?: PropertyStatus;
      typeUuid?: string;
      categoryUuid?: string;
      subcategoryUuid?: string;
      isActive?: boolean;
    },
  ) {
    return this.repository.listProperties(query);
  }

  async updateProperty(
    uuid: string,
    version: number,
    patch: Record<string, unknown>,
    actor: ActorContext,
  ) {
    const current = await this.run(() => this.repository.getProperty(uuid));
    const currentRecord = current as Record<string, unknown>;
    const currentStatus = toStatus(currentRecord.status, 'DRAFT');
    const nextStatus = toStatus(patch.status, currentStatus);
    if (nextStatus === 'ACTIVE' && currentStatus !== 'ACTIVE') {
      throw new BadRequestException(
        'Property activation must use the verify/publish workflow',
      );
    }
    assertTransition(currentStatus, nextStatus);
    const from =
      patch.availableFrom !== undefined
        ? toDate(patch.availableFrom)
        : toDate(currentRecord.availableFrom);
    const to =
      patch.availableTo !== undefined
        ? toDate(patch.availableTo)
        : toDate(currentRecord.availableTo);
    assertAvailability(from, to);
    const result = await this.run(() =>
      this.repository.updateProperty(uuid, version, patch, actor),
    );
    const updatedRecord = result as Record<string, unknown>;
    await this.recordAudit(
      AUDIT_ACTIONS.PROPERTY_UPDATED,
      uuid,
      actor,
      diff(currentRecord, updatedRecord),
    );
    if (currentStatus !== nextStatus && nextStatus === 'ARCHIVED') {
      await this.recordAudit(AUDIT_ACTIONS.PROPERTY_ARCHIVED, uuid, actor);
    }
    return result;
  }

  async verifyProperty(uuid: string, version: number, actor: ActorContext) {
    const current = (await this.run(() =>
      this.repository.getProperty(uuid),
    )) as Record<string, unknown>;
    if (toStatus(current.status, 'DRAFT') !== 'IN_REVIEW') {
      throw new BadRequestException(
        'Only properties in IN_REVIEW can be verified',
      );
    }
    const result = await this.run(() =>
      this.repository.updateProperty(
        uuid,
        version,
        { verifiedAt: new Date(), verifiedBy: actor.actorUuid ?? null },
        actor,
      ),
    );
    await this.recordAudit(
      AUDIT_ACTIONS.PROPERTY_VERIFIED,
      uuid,
      actor,
      diff(current, result as Record<string, unknown>),
    );
    return result;
  }

  async publishProperty(uuid: string, version: number, actor: ActorContext) {
    const current = (await this.run(() =>
      this.repository.getProperty(uuid),
    )) as Record<string, unknown>;
    if (toStatus(current.status, 'DRAFT') !== 'IN_REVIEW') {
      throw new BadRequestException(
        'Only properties in IN_REVIEW can be published',
      );
    }
    if (!current.verifiedAt) {
      throw new BadRequestException(
        'Property must be verified before publishing',
      );
    }
    const result = await this.run(() =>
      this.repository.updateProperty(
        uuid,
        version,
        { status: 'ACTIVE', publishedAt: new Date() },
        actor,
      ),
    );
    await this.recordAudit(
      AUDIT_ACTIONS.PROPERTY_PUBLISHED,
      uuid,
      actor,
      diff(current, result as Record<string, unknown>),
    );
    return result;
  }

  async deleteProperty(uuid: string, actor: ActorContext) {
    await this.run(() => this.repository.deleteProperty(uuid, actor));
    await this.recordAudit(AUDIT_ACTIONS.PROPERTY_DELETED, uuid, actor);
  }
  async restoreProperty(uuid: string, actor: ActorContext) {
    const result = await this.run(() =>
      this.repository.restoreProperty(uuid, actor),
    );
    await this.recordAudit(AUDIT_ACTIONS.PROPERTY_RESTORED, uuid, actor);
    return result;
  }
  async duplicateProperty(uuid: string, actor: ActorContext) {
    const result = await this.run(() =>
      this.repository.duplicateProperty(uuid, actor),
    );
    const record = result as Record<string, unknown>;
    await this.recordAudit(
      AUDIT_ACTIONS.PROPERTY_DUPLICATED,
      record.uuid ?? uuid,
      actor,
    );
    return result;
  }

  private async recordAudit(
    action: string,
    entityUuid: unknown,
    actor: ActorContext,
    changes?: readonly SecurityAuditChange[],
  ) {
    if (typeof entityUuid !== 'string' || !entityUuid) return;
    await this.audit.record({
      action,
      actorUuid: actor.actorUuid,
      subjectUuid: actor.actorUuid,
      actorType: actor.actorUuid ? 'AUTHENTICATED' : 'SYSTEM',
      entityType: 'property',
      entityUuid,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
      result: 'SUCCESS',
      changes,
    });
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      if (error instanceof MasterNotFoundError)
        throw new NotFoundException(error.message);
      if (
        error instanceof MasterConflictError ||
        error instanceof MasterInUseError ||
        error instanceof MasterConcurrencyError
      )
        throw new ConflictException(error.message);
      if (
        error instanceof MasterHierarchyError ||
        error instanceof MasterStateError
      )
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
