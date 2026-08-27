import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  SecurityAuditChange,
  SecurityAuditRepository,
} from '../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import { PROPERTY_DETAILS_REPOSITORY } from '../domain/repositories/property-details.repository.js';
import type {
  BuildingPatch,
  FacilityAssignmentInput,
  LocationPatch,
  PropertyDetailsRepository,
  RoomCreateInput,
  RoomUpdateInput,
  SpecificationPatch,
} from '../domain/repositories/property-details.repository.js';
import {
  PropertyDetailConflictError,
  PropertyDetailInvalidStateError,
  PropertyDetailNotFoundError,
} from '../domain/property-details.js';
import type { PropertyDetailsActor } from '../domain/property-details.js';

const isNamedDetailError = (
  error: unknown,
  names: readonly string[],
): boolean => error instanceof Error && names.includes(error.name);

@Injectable()
export class PropertyDetailsService {
  constructor(
    @Inject(PROPERTY_DETAILS_REPOSITORY)
    private readonly repository: PropertyDetailsRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  getSpecifications(propertyUuid: string): Promise<unknown> {
    return this.run(() => this.repository.getSpecifications(propertyUuid));
  }

  async updateSpecifications(
    propertyUuid: string,
    patch: SpecificationPatch,
    actor: PropertyDetailsActor,
  ): Promise<unknown> {
    const result = await this.run(() =>
      this.repository.upsertSpecifications(propertyUuid, patch, actor),
    );
    await this.record(
      'property.specifications.update',
      'property_specification',
      propertyUuid,
      actor,
      patch,
    );
    return result;
  }

  getLocation(propertyUuid: string): Promise<unknown> {
    return this.run(() => this.repository.getLocation(propertyUuid));
  }

  async updateLocation(
    propertyUuid: string,
    patch: LocationPatch,
    actor: PropertyDetailsActor,
  ): Promise<unknown> {
    const result = await this.run(() =>
      this.repository.updateLocation(propertyUuid, patch, actor),
    );
    await this.record(
      'property.location.update',
      'property_location',
      propertyUuid,
      actor,
      patch,
    );
    return result;
  }

  getBuilding(propertyUuid: string): Promise<unknown> {
    return this.run(() => this.repository.getBuilding(propertyUuid));
  }

  async updateBuilding(
    propertyUuid: string,
    patch: BuildingPatch,
    actor: PropertyDetailsActor,
  ): Promise<unknown> {
    const result = await this.run(() =>
      this.repository.updateBuilding(propertyUuid, patch, actor),
    );
    await this.record(
      'property.building.update',
      'property_building',
      propertyUuid,
      actor,
      patch,
    );
    return result;
  }

  listRooms(propertyUuid: string): Promise<unknown[]> {
    return this.run(() => this.repository.listRooms(propertyUuid));
  }

  async createRoom(
    propertyUuid: string,
    input: RoomCreateInput,
    actor: PropertyDetailsActor,
  ): Promise<unknown> {
    const result = await this.run(() =>
      this.repository.createRoom(propertyUuid, input, actor),
    );
    await this.record(
      'property.room.create',
      'property_room',
      propertyUuid,
      actor,
      {
        roomType: input.roomType,
        floor: input.floor,
      },
    );
    return result;
  }

  async updateRoom(
    propertyUuid: string,
    roomUuid: string,
    patch: RoomUpdateInput,
    actor: PropertyDetailsActor,
  ): Promise<unknown> {
    const result = await this.run(() =>
      this.repository.updateRoom(propertyUuid, roomUuid, patch, actor),
    );
    await this.record(
      'property.room.update',
      'property_room',
      roomUuid,
      actor,
      patch,
    );
    return result;
  }

  async deleteRoom(
    propertyUuid: string,
    roomUuid: string,
    actor: PropertyDetailsActor,
  ): Promise<void> {
    await this.run(() =>
      this.repository.deleteRoom(propertyUuid, roomUuid, actor),
    );
    await this.record('property.room.delete', 'property_room', roomUuid, actor);
  }

  async reorderRooms(
    propertyUuid: string,
    roomUuids: string[],
    actor: PropertyDetailsActor,
  ): Promise<unknown[]> {
    if (new Set(roomUuids).size !== roomUuids.length)
      throw new BadRequestException('roomUuids must not contain duplicates');
    const result = await this.run(() =>
      this.repository.reorderRooms(propertyUuid, roomUuids, actor),
    );
    await this.record(
      'property.rooms.reorder',
      'property',
      propertyUuid,
      actor,
      {
        count: roomUuids.length,
      },
    );
    return result;
  }

  listPropertyFacilities(propertyUuid: string): Promise<unknown[]> {
    return this.run(() => this.repository.listPropertyFacilities(propertyUuid));
  }

  async attachFacility(
    propertyUuid: string,
    input: FacilityAssignmentInput,
    actor: PropertyDetailsActor,
  ): Promise<unknown> {
    const result = await this.run(() =>
      this.repository.attachFacility(propertyUuid, input, actor),
    );
    await this.record(
      'property.facility.attach',
      'property_facility',
      propertyUuid,
      actor,
      {
        facilityUuid: input.facilityUuid,
      },
    );
    return result;
  }

  async updateFacility(
    propertyUuid: string,
    facilityUuid: string,
    patch: Omit<FacilityAssignmentInput, 'facilityUuid'>,
    actor: PropertyDetailsActor,
  ): Promise<unknown> {
    const result = await this.run(() =>
      this.repository.updateFacilityAssignment(
        propertyUuid,
        facilityUuid,
        patch,
        actor,
      ),
    );
    await this.record(
      'property.facility.update',
      'property_facility',
      propertyUuid,
      actor,
      {
        facilityUuid,
        ...patch,
      },
    );
    return result;
  }

  async detachFacility(
    propertyUuid: string,
    facilityUuid: string,
    actor: PropertyDetailsActor,
  ): Promise<void> {
    await this.run(() =>
      this.repository.detachFacility(propertyUuid, facilityUuid, actor),
    );
    await this.record(
      'property.facility.detach',
      'property_facility',
      propertyUuid,
      actor,
      {
        facilityUuid,
      },
    );
  }

  async bulkAttachFacilities(
    propertyUuid: string,
    facilityUuids: string[],
    actor: PropertyDetailsActor,
  ): Promise<unknown[]> {
    if (new Set(facilityUuids).size !== facilityUuids.length)
      throw new BadRequestException(
        'facilityUuids must not contain duplicates',
      );
    const result = await this.run(() =>
      this.repository.bulkAttachFacilities(
        propertyUuid,
        facilityUuids.map((facilityUuid) => ({ facilityUuid })),
        actor,
      ),
    );
    await this.record(
      'property.facility.bulk_attach',
      'property',
      propertyUuid,
      actor,
      {
        count: facilityUuids.length,
      },
    );
    return result;
  }

  private async record(
    action: string,
    entityType: string,
    entityUuid: string,
    actor: PropertyDetailsActor,
    changes?: unknown,
  ): Promise<void> {
    const auditChanges: readonly SecurityAuditChange[] | undefined =
      typeof changes === 'object' && changes !== null
        ? Object.entries(changes as Record<string, unknown>).flatMap(
            ([field, value]) =>
              typeof value === 'string' ||
              typeof value === 'boolean' ||
              (typeof value === 'number' && Number.isFinite(value)) ||
              value === null
                ? [{ field, oldValue: null, newValue: value }]
                : [],
          )
        : undefined;
    await this.audit.record({
      action,
      actorUuid: actor.actorUuid,
      subjectUuid: actor.actorUuid,
      actorType: 'AUTHENTICATED',
      entityType,
      entityUuid,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
      result: 'SUCCESS',
      changes: auditChanges,
    });
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (
        error instanceof PropertyDetailNotFoundError ||
        isNamedDetailError(error, ['PropertyDetailNotFoundError'])
      )
        throw new NotFoundException(
          error instanceof Error ? error.message : 'Property detail not found',
        );
      if (
        error instanceof PropertyDetailConflictError ||
        isNamedDetailError(error, ['PropertyDetailConflictError'])
      )
        throw new ConflictException(
          error instanceof Error ? error.message : 'Property detail conflict',
        );
      if (
        error instanceof PropertyDetailInvalidStateError ||
        isNamedDetailError(error, ['PropertyDetailInvalidStateError'])
      )
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid property detail',
        );
      throw error;
    }
  }
}
