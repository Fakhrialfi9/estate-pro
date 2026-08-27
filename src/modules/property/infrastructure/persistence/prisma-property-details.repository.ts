import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  assertCoordinatePair,
  assertLocationHierarchy,
  assertPoolInvariants,
  assertRoomInvariants,
  assertSpecificationInvariants,
  PropertyDetailConflictError,
  PropertyDetailInvalidStateError,
  PropertyDetailNotFoundError,
} from '../../domain/property-details.js';
import type {
  BuildingPatch,
  FacilityAssignmentInput,
  LocationPatch,
  PropertyDetailsRepository,
  RoomCreateInput,
  RoomUpdateInput,
  SpecificationPatch,
} from '../../domain/repositories/property-details.repository.js';

type Tx = Prisma.TransactionClient;
type LocationIds = {
  countryId: bigint | null;
  provinceId: bigint | null;
  cityId: bigint | null;
  districtId: bigint | null;
  subdistrictId: bigint | null;
};
type MasterLevel = keyof LocationIds extends never
  ? never
  : 'country' | 'province' | 'city' | 'district' | 'subdistrict';

const trim = (value: string | null | undefined): string | null | undefined =>
  value === undefined ? undefined : value === null ? null : value.trim();

@Injectable()
export class PrismaPropertyDetailsRepository
  implements PropertyDetailsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private async propertyId(
    client: PrismaService | Tx,
    propertyUuid: string,
  ): Promise<bigint> {
    const property = await client.property.findFirst({
      where: { uuid: propertyUuid, deletedAt: null },
      select: { id: true },
    });
    if (!property) throw new PropertyDetailNotFoundError('Property not found');
    return property.id;
  }

  private async masterId(
    tx: Tx,
    level: MasterLevel,
    uuid: string,
  ): Promise<bigint> {
    switch (level) {
      case 'country': {
        const row = await tx.country.findFirst({
          where: { uuid, deletedAt: null, isActive: true },
          select: { id: true },
        });
        if (!row)
          throw new PropertyDetailInvalidStateError(
            'Country not found or inactive',
          );
        return row.id;
      }
      case 'province': {
        const row = await tx.province.findFirst({
          where: { uuid, deletedAt: null, isActive: true },
          select: { id: true },
        });
        if (!row)
          throw new PropertyDetailInvalidStateError(
            'Province not found or inactive',
          );
        return row.id;
      }
      case 'city': {
        const row = await tx.city.findFirst({
          where: { uuid, deletedAt: null, isActive: true },
          select: { id: true },
        });
        if (!row)
          throw new PropertyDetailInvalidStateError(
            'City not found or inactive',
          );
        return row.id;
      }
      case 'district': {
        const row = await tx.district.findFirst({
          where: { uuid, deletedAt: null, isActive: true },
          select: { id: true },
        });
        if (!row)
          throw new PropertyDetailInvalidStateError(
            'District not found or inactive',
          );
        return row.id;
      }
      case 'subdistrict': {
        const row = await tx.subdistrict.findFirst({
          where: { uuid, deletedAt: null, isActive: true },
          select: { id: true },
        });
        if (!row)
          throw new PropertyDetailInvalidStateError(
            'Subdistrict not found or inactive',
          );
        return row.id;
      }
    }
  }

  private async resolveLocationIds(
    tx: Tx,
    current: LocationIds | null,
    patch: LocationPatch,
  ): Promise<LocationIds> {
    const value = async (
      level: MasterLevel,
      uuid: string | null | undefined,
      currentId: bigint | null,
    ): Promise<bigint | null> =>
      uuid === undefined
        ? currentId
        : uuid === null
          ? null
          : this.masterId(tx, level, uuid);
    const countryId = await value(
      'country',
      patch.countryUuid,
      current?.countryId ?? null,
    );
    const provinceId = await value(
      'province',
      patch.provinceUuid,
      current?.provinceId ?? null,
    );
    const cityId = await value('city', patch.cityUuid, current?.cityId ?? null);
    const districtId = await value(
      'district',
      patch.districtUuid,
      current?.districtId ?? null,
    );
    const subdistrictId = await value(
      'subdistrict',
      patch.subdistrictUuid,
      current?.subdistrictId ?? null,
    );
    if (provinceId !== null) {
      const row = await tx.province.findUnique({
        where: { id: provinceId },
        select: { countryId: true },
      });
      if (!row || row.countryId !== countryId)
        throw new PropertyDetailInvalidStateError(
          'Province does not belong to country',
        );
    }
    if (cityId !== null) {
      const row = await tx.city.findUnique({
        where: { id: cityId },
        select: { provinceId: true },
      });
      if (!row || row.provinceId !== provinceId)
        throw new PropertyDetailInvalidStateError(
          'City does not belong to province',
        );
    }
    if (districtId !== null) {
      const row = await tx.district.findUnique({
        where: { id: districtId },
        select: { cityId: true },
      });
      if (!row || row.cityId !== cityId)
        throw new PropertyDetailInvalidStateError(
          'District does not belong to city',
        );
    }
    if (subdistrictId !== null) {
      const row = await tx.subdistrict.findUnique({
        where: { id: subdistrictId },
        select: { districtId: true },
      });
      if (!row || row.districtId !== districtId)
        throw new PropertyDetailInvalidStateError(
          'Subdistrict does not belong to district',
        );
    }
    assertLocationHierarchy(
      [countryId, provinceId, cityId, districtId, subdistrictId].map((id) =>
        id?.toString(),
      ),
    );
    return { countryId, provinceId, cityId, districtId, subdistrictId };
  }

  private mapError(error: unknown): never {
    if (
      error instanceof PropertyDetailNotFoundError ||
      error instanceof PropertyDetailConflictError ||
      error instanceof PropertyDetailInvalidStateError
    )
      throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new PropertyDetailConflictError(
          'A unique property detail value already exists',
        );
      if (error.code === 'P2003')
        throw new PropertyDetailInvalidStateError(
          'Referenced resource is invalid',
        );
      if (error.code === 'P2025')
        throw new PropertyDetailNotFoundError('Property detail was not found');
    }
    throw error;
  }

  async getSpecifications(propertyUuid: string): Promise<unknown> {
    const propertyId = await this.propertyId(this.prisma, propertyUuid);
    const result = await this.prisma.propertySpecification.findUnique({
      where: { propertyId },
    });
    if (!result)
      throw new PropertyDetailNotFoundError(
        'Property specifications not found',
      );
    return result;
  }

  async upsertSpecifications(
    propertyUuid: string,
    patch: SpecificationPatch,
    actor: { actorUuid?: string },
  ): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const current = await tx.propertySpecification.findUnique({
          where: { propertyId },
        });
        const merged = {
          landArea: patch.landArea ?? current?.landArea?.toString() ?? null,
          buildingArea:
            patch.buildingArea ?? current?.buildingArea?.toString() ?? null,
          floorArea: patch.floorArea ?? current?.floorArea?.toString() ?? null,
          bedrooms: patch.bedrooms ?? current?.bedrooms ?? 0,
          bathrooms: patch.bathrooms ?? current?.bathrooms?.toString() ?? '0',
          maidRooms: patch.maidRooms ?? current?.maidRooms ?? 0,
          guestToilets: patch.guestToilets ?? current?.guestToilets ?? 0,
          floors: patch.floors ?? current?.floors ?? 1,
          parkingType: patch.parkingType ?? current?.parkingType ?? 'NONE',
          parkingSpaces: patch.parkingSpaces ?? current?.parkingSpaces ?? 0,
          livingRooms: patch.livingRooms ?? current?.livingRooms ?? 0,
          familyRooms: patch.familyRooms ?? current?.familyRooms ?? 0,
          diningRooms: patch.diningRooms ?? current?.diningRooms ?? 0,
          kitchens: patch.kitchens ?? current?.kitchens ?? 0,
          yearBuilt:
            patch.yearBuilt !== undefined
              ? patch.yearBuilt
              : current?.yearBuilt,
          yearRenovated:
            patch.yearRenovated !== undefined
              ? patch.yearRenovated
              : current?.yearRenovated,
          ceilingHeightM:
            patch.ceilingHeightM !== undefined
              ? patch.ceilingHeightM
              : (current?.ceilingHeightM?.toString() ?? null),
          frontageM:
            patch.frontageM !== undefined
              ? patch.frontageM
              : (current?.frontageM?.toString() ?? null),
          roadWidthM:
            patch.roadWidthM !== undefined
              ? patch.roadWidthM
              : (current?.roadWidthM?.toString() ?? null),
        };
        assertSpecificationInvariants(merged);
        const common = {
          landArea: patch.landArea,
          buildingArea: patch.buildingArea,
          floorArea: patch.floorArea,
          bedrooms: patch.bedrooms,
          bathrooms: patch.bathrooms,
          maidRooms: patch.maidRooms,
          guestToilets: patch.guestToilets,
          floors: patch.floors,
          parkingType: patch.parkingType,
          parkingSpaces: patch.parkingSpaces,
          livingRooms: patch.livingRooms,
          familyRooms: patch.familyRooms,
          diningRooms: patch.diningRooms,
          kitchens: patch.kitchens,
          yearBuilt: patch.yearBuilt,
          yearRenovated: patch.yearRenovated,
          orientation: patch.orientation,
          condition: patch.condition,
          furnishedStatus: patch.furnishedStatus,
          ceilingHeightM: patch.ceilingHeightM,
          frontageM: patch.frontageM,
          roadWidthM: patch.roadWidthM,
          updatedBy: actor.actorUuid ?? null,
        };
        if (current)
          return tx.propertySpecification.update({
            where: { id: current.id },
            data: common,
          });
        return tx.propertySpecification.create({
          data: {
            uuid: randomUUID(),
            propertyId,
            landArea: merged.landArea,
            buildingArea: merged.buildingArea,
            floorArea: merged.floorArea,
            bedrooms: merged.bedrooms,
            bathrooms: merged.bathrooms,
            maidRooms: merged.maidRooms,
            guestToilets: merged.guestToilets,
            floors: merged.floors,
            parkingType: merged.parkingType,
            parkingSpaces: merged.parkingSpaces,
            livingRooms: merged.livingRooms,
            familyRooms: merged.familyRooms,
            diningRooms: merged.diningRooms,
            kitchens: merged.kitchens,
            yearBuilt: merged.yearBuilt ?? null,
            yearRenovated: merged.yearRenovated ?? null,
            orientation: patch.orientation ?? 'UNKNOWN',
            condition: patch.condition ?? 'GOOD',
            furnishedStatus: patch.furnishedStatus ?? 'UNFURNISHED',
            ceilingHeightM: merged.ceilingHeightM,
            frontageM: merged.frontageM,
            roadWidthM: merged.roadWidthM,
            createdBy: actor.actorUuid ?? null,
            updatedBy: actor.actorUuid ?? null,
          },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  async getLocation(propertyUuid: string): Promise<unknown> {
    const propertyId = await this.propertyId(this.prisma, propertyUuid);
    const result = await this.prisma.propertyLocation.findUnique({
      where: { propertyId },
      include: {
        country: { select: { uuid: true, code: true, name: true, slug: true } },
        province: {
          select: { uuid: true, code: true, name: true, slug: true },
        },
        city: { select: { uuid: true, code: true, name: true, slug: true } },
        district: {
          select: { uuid: true, code: true, name: true, slug: true },
        },
        subdistrict: {
          select: { uuid: true, code: true, name: true, slug: true },
        },
      },
    });
    if (!result)
      throw new PropertyDetailNotFoundError('Property location not found');
    return result;
  }

  async updateLocation(
    propertyUuid: string,
    patch: LocationPatch,
    actor: { actorUuid?: string },
  ): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const current = await tx.propertyLocation.findUnique({
          where: { propertyId },
        });
        const ids = await this.resolveLocationIds(tx, current, patch);
        const latitude =
          patch.latitude !== undefined
            ? patch.latitude
            : (current?.latitude?.toString() ?? null);
        const longitude =
          patch.longitude !== undefined
            ? patch.longitude
            : (current?.longitude?.toString() ?? null);
        assertCoordinatePair(latitude, longitude);
        if (patch.subdistrictUuid !== undefined)
          await tx.property.update({
            where: { id: propertyId },
            data: {
              subdistrictId: ids.subdistrictId,
              updatedBy: actor.actorUuid ?? null,
            },
          });
        const scalar = {
          countryId:
            patch.countryUuid === undefined ? undefined : ids.countryId,
          provinceId:
            patch.provinceUuid === undefined ? undefined : ids.provinceId,
          cityId: patch.cityUuid === undefined ? undefined : ids.cityId,
          districtId:
            patch.districtUuid === undefined ? undefined : ids.districtId,
          subdistrictId:
            patch.subdistrictUuid === undefined ? undefined : ids.subdistrictId,
          addressLine: trim(patch.addressLine),
          street: trim(patch.street),
          building: trim(patch.building),
          block: trim(patch.block),
          unit: trim(patch.unit),
          neighborhood: trim(patch.neighborhood),
          postalCode: trim(patch.postalCode),
          latitude: patch.latitude,
          longitude: patch.longitude,
          coordinateAccuracy: patch.coordinateAccuracy,
          mapProvider: patch.mapProvider,
          placeId: trim(patch.placeId),
          mapUrl: trim(patch.mapUrl),
          floodRisk: patch.floodRisk,
          earthquakeRisk: patch.earthquakeRisk,
          trafficRisk: patch.trafficRisk,
          noiseRisk: patch.noiseRisk,
          airQualityRisk: patch.airQualityRisk,
          updatedBy: actor.actorUuid ?? null,
        };
        if (current)
          return tx.propertyLocation.update({
            where: { id: current.id },
            data: scalar,
          });
        return tx.propertyLocation.create({
          data: {
            uuid: randomUUID(),
            propertyId,
            countryId: ids.countryId,
            provinceId: ids.provinceId,
            cityId: ids.cityId,
            districtId: ids.districtId,
            subdistrictId: ids.subdistrictId,
            addressLine: trim(patch.addressLine) ?? null,
            street: trim(patch.street) ?? null,
            building: trim(patch.building) ?? null,
            block: trim(patch.block) ?? null,
            unit: trim(patch.unit) ?? null,
            neighborhood: trim(patch.neighborhood) ?? null,
            postalCode: trim(patch.postalCode) ?? null,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            coordinateAccuracy: patch.coordinateAccuracy ?? 'UNKNOWN',
            mapProvider: patch.mapProvider ?? null,
            placeId: trim(patch.placeId) ?? null,
            mapUrl: trim(patch.mapUrl) ?? null,
            floodRisk: patch.floodRisk ?? 'UNKNOWN',
            earthquakeRisk: patch.earthquakeRisk ?? 'UNKNOWN',
            trafficRisk: patch.trafficRisk ?? 'UNKNOWN',
            noiseRisk: patch.noiseRisk ?? 'UNKNOWN',
            airQualityRisk: patch.airQualityRisk ?? 'UNKNOWN',
            createdBy: actor.actorUuid ?? null,
            updatedBy: actor.actorUuid ?? null,
          },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  async getBuilding(propertyUuid: string): Promise<unknown> {
    const propertyId = await this.propertyId(this.prisma, propertyUuid);
    const result = await this.prisma.propertyBuilding.findUnique({
      where: { propertyId },
    });
    if (!result)
      throw new PropertyDetailNotFoundError('Property building not found');
    return result;
  }

  async updateBuilding(
    propertyUuid: string,
    patch: BuildingPatch,
    actor: { actorUuid?: string },
  ): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const current = await tx.propertyBuilding.findUnique({
          where: { propertyId },
        });
        const merged = {
          hasPool: patch.hasPool ?? current?.hasPool ?? false,
          poolLengthM:
            patch.poolLengthM !== undefined
              ? patch.poolLengthM
              : (current?.poolLengthM?.toString() ?? null),
          poolWidthM:
            patch.poolWidthM !== undefined
              ? patch.poolWidthM
              : (current?.poolWidthM?.toString() ?? null),
          poolDepthM:
            patch.poolDepthM !== undefined
              ? patch.poolDepthM
              : (current?.poolDepthM?.toString() ?? null),
        };
        assertPoolInvariants(merged);
        const data = {
          foundation: trim(patch.foundation),
          structure: trim(patch.structure),
          walls: trim(patch.walls),
          roof: trim(patch.roof),
          flooring: trim(patch.flooring),
          doors: trim(patch.doors),
          windows: trim(patch.windows),
          facade: trim(patch.facade),
          garden: trim(patch.garden),
          terrace: trim(patch.terrace),
          balcony: trim(patch.balcony),
          rooftop: trim(patch.rooftop),
          hasPool: patch.hasPool,
          poolLengthM: patch.poolLengthM,
          poolWidthM: patch.poolWidthM,
          poolDepthM: patch.poolDepthM,
          interiorStyle: trim(patch.interiorStyle),
          interiorDesign: trim(patch.interiorDesign),
          naturalLighting: patch.naturalLighting,
          ventilation: patch.ventilation,
          smartHome: patch.smartHome,
          soundproofing: patch.soundproofing,
          updatedBy: actor.actorUuid ?? null,
        };
        if (current)
          return tx.propertyBuilding.update({
            where: { id: current.id },
            data,
          });
        return tx.propertyBuilding.create({
          data: {
            uuid: randomUUID(),
            propertyId,
            foundation: trim(patch.foundation) ?? null,
            structure: trim(patch.structure) ?? null,
            walls: trim(patch.walls) ?? null,
            roof: trim(patch.roof) ?? null,
            flooring: trim(patch.flooring) ?? null,
            doors: trim(patch.doors) ?? null,
            windows: trim(patch.windows) ?? null,
            facade: trim(patch.facade) ?? null,
            garden: trim(patch.garden) ?? null,
            terrace: trim(patch.terrace) ?? null,
            balcony: trim(patch.balcony) ?? null,
            rooftop: trim(patch.rooftop) ?? null,
            hasPool: merged.hasPool,
            poolLengthM: merged.poolLengthM,
            poolWidthM: merged.poolWidthM,
            poolDepthM: merged.poolDepthM,
            interiorStyle: trim(patch.interiorStyle) ?? null,
            interiorDesign: trim(patch.interiorDesign) ?? null,
            naturalLighting: patch.naturalLighting ?? 'MODERATE',
            ventilation: patch.ventilation ?? 'NATURAL',
            smartHome: patch.smartHome ?? false,
            soundproofing: patch.soundproofing ?? false,
            createdBy: actor.actorUuid ?? null,
            updatedBy: actor.actorUuid ?? null,
          },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  async listRooms(propertyUuid: string): Promise<unknown[]> {
    const propertyId = await this.propertyId(this.prisma, propertyUuid);
    return this.prisma.propertyRoom.findMany({
      where: { propertyId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { uuid: 'asc' }],
    });
  }
  async createRoom(
    propertyUuid: string,
    input: RoomCreateInput,
    actor: { actorUuid?: string },
  ): Promise<unknown> {
    try {
      assertRoomInvariants(input);
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        return tx.propertyRoom.create({
          data: {
            uuid: randomUUID(),
            propertyId,
            roomType: input.roomType,
            name: input.name.trim(),
            floor: input.floor,
            area: input.area,
            hasBathroom: input.hasBathroom ?? false,
            hasWalkInCloset: input.hasWalkInCloset ?? false,
            hasBalcony: input.hasBalcony ?? false,
            hasAirConditioning: input.hasAirConditioning ?? false,
            sortOrder: input.sortOrder ?? 0,
            createdBy: actor.actorUuid ?? null,
            updatedBy: actor.actorUuid ?? null,
          },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }
  async updateRoom(
    propertyUuid: string,
    roomUuid: string,
    patch: RoomUpdateInput,
    actor: { actorUuid?: string },
  ): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const current = await tx.propertyRoom.findFirst({
          where: { uuid: roomUuid, propertyId, deletedAt: null },
        });
        if (!current)
          throw new PropertyDetailNotFoundError('Property room not found');
        assertRoomInvariants({
          floor: patch.floor ?? current.floor,
          area: patch.area ?? current.area.toString(),
        });
        return tx.propertyRoom.update({
          where: { id: current.id },
          data: {
            roomType: patch.roomType,
            name: patch.name === undefined ? undefined : patch.name.trim(),
            floor: patch.floor,
            area: patch.area,
            hasBathroom: patch.hasBathroom,
            hasWalkInCloset: patch.hasWalkInCloset,
            hasBalcony: patch.hasBalcony,
            hasAirConditioning: patch.hasAirConditioning,
            sortOrder: patch.sortOrder,
            updatedBy: actor.actorUuid ?? null,
          },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }
  async deleteRoom(
    propertyUuid: string,
    roomUuid: string,
    actor: { actorUuid?: string },
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const current = await tx.propertyRoom.findFirst({
          where: { uuid: roomUuid, propertyId, deletedAt: null },
          select: { id: true },
        });
        if (!current)
          throw new PropertyDetailNotFoundError('Property room not found');
        await tx.propertyRoom.update({
          where: { id: current.id },
          data: { deletedAt: new Date(), updatedBy: actor.actorUuid ?? null },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }
  async reorderRooms(
    propertyUuid: string,
    roomUuids: string[],
    actor: { actorUuid?: string },
  ): Promise<unknown[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const rooms = await tx.propertyRoom.findMany({
          where: { propertyId, deletedAt: null },
          select: { id: true, uuid: true },
        });
        if (
          rooms.length !== roomUuids.length ||
          new Set(roomUuids).size !== roomUuids.length
        )
          throw new PropertyDetailInvalidStateError(
            'roomUuids must contain every active room exactly once',
          );
        const byUuid = new Map(rooms.map((room) => [room.uuid, room.id]));
        if (roomUuids.some((uuid) => !byUuid.has(uuid)))
          throw new PropertyDetailInvalidStateError(
            'All rooms must belong to the property',
          );
        for (const [index, uuid] of roomUuids.entries())
          await tx.propertyRoom.update({
            where: { id: byUuid.get(uuid)! },
            data: { sortOrder: index, updatedBy: actor.actorUuid ?? null },
          });
        return tx.propertyRoom.findMany({
          where: { propertyId, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { uuid: 'asc' }],
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  async listPropertyFacilities(propertyUuid: string): Promise<unknown[]> {
    const propertyId = await this.propertyId(this.prisma, propertyUuid);
    return this.prisma.propertyFacility.findMany({
      where: { propertyId },
      include: {
        facility: {
          select: {
            uuid: true,
            code: true,
            name: true,
            slug: true,
            category: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { facilityId: 'asc' }],
    });
  }
  private async activeFacilityId(tx: Tx, uuid: string): Promise<bigint> {
    const facility = await tx.facility.findFirst({
      where: { uuid, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!facility)
      throw new PropertyDetailInvalidStateError(
        'Facility not found or inactive',
      );
    return facility.id;
  }
  private async anyFacilityId(tx: Tx, uuid: string): Promise<bigint> {
    const facility = await tx.facility.findFirst({
      where: { uuid, deletedAt: null },
      select: { id: true },
    });
    if (!facility) throw new PropertyDetailNotFoundError('Facility not found');
    return facility.id;
  }
  async attachFacility(
    propertyUuid: string,
    input: FacilityAssignmentInput,
  ): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const facilityId = await this.activeFacilityId(tx, input.facilityUuid);
        const existing = await tx.propertyFacility.findUnique({
          where: { propertyId_facilityId: { propertyId, facilityId } },
          select: { propertyId: true },
        });
        if (existing)
          throw new PropertyDetailConflictError(
            'Facility is already attached to the property',
          );
        return tx.propertyFacility.create({
          data: {
            propertyId,
            facilityId,
            available: input.available ?? true,
            quantity: input.quantity ?? null,
            notes: trim(input.notes) ?? null,
          },
          include: {
            facility: {
              select: {
                uuid: true,
                code: true,
                name: true,
                slug: true,
                category: true,
                isActive: true,
              },
            },
          },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }
  async updateFacilityAssignment(
    propertyUuid: string,
    facilityUuid: string,
    patch: Omit<FacilityAssignmentInput, 'facilityUuid'>,
  ): Promise<unknown> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const facilityId = await this.anyFacilityId(tx, facilityUuid);
        const current = await tx.propertyFacility.findUnique({
          where: { propertyId_facilityId: { propertyId, facilityId } },
        });
        if (!current)
          throw new PropertyDetailNotFoundError(
            'Facility assignment not found',
          );
        return tx.propertyFacility.update({
          where: { propertyId_facilityId: { propertyId, facilityId } },
          data: {
            available: patch.available,
            quantity: patch.quantity,
            notes: trim(patch.notes),
            updatedAt: new Date(),
          },
          include: {
            facility: {
              select: {
                uuid: true,
                code: true,
                name: true,
                slug: true,
                category: true,
                isActive: true,
              },
            },
          },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }
  async detachFacility(
    propertyUuid: string,
    facilityUuid: string,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const facilityId = await this.anyFacilityId(tx, facilityUuid);
        const current = await tx.propertyFacility.findUnique({
          where: { propertyId_facilityId: { propertyId, facilityId } },
          select: { propertyId: true },
        });
        if (!current)
          throw new PropertyDetailNotFoundError(
            'Facility assignment not found',
          );
        await tx.propertyFacility.delete({
          where: { propertyId_facilityId: { propertyId, facilityId } },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }
  async bulkAttachFacilities(
    propertyUuid: string,
    inputs: FacilityAssignmentInput[],
  ): Promise<unknown[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const propertyId = await this.propertyId(tx, propertyUuid);
        const uuids = inputs.map((input) => input.facilityUuid);
        if (new Set(uuids).size !== uuids.length)
          throw new PropertyDetailConflictError(
            'Duplicate facility UUIDs are not allowed',
          );
        const ids: bigint[] = [];
        for (const uuid of uuids)
          ids.push(await this.activeFacilityId(tx, uuid));
        if (ids.length) {
          const existing = await tx.propertyFacility.findMany({
            where: { propertyId, facilityId: { in: ids } },
            select: { facilityId: true },
          });
          if (existing.length)
            throw new PropertyDetailConflictError(
              'One or more facilities are already attached to the property',
            );
          await tx.propertyFacility.createMany({
            data: ids.map((facilityId, index) => {
              const input = inputs[index];
              if (!input)
                throw new PropertyDetailInvalidStateError(
                  'Facility input is missing for the resolved facility id',
                );
              return {
                propertyId,
                facilityId,
                available: input.available ?? true,
                quantity: input.quantity ?? null,
                notes: trim(input.notes) ?? null,
              };
            }),
          });
        }
        return tx.propertyFacility.findMany({
          where: { propertyId, facilityId: { in: ids } },
          include: {
            facility: {
              select: {
                uuid: true,
                code: true,
                name: true,
                slug: true,
                category: true,
                isActive: true,
              },
            },
          },
        });
      });
    } catch (error: unknown) {
      this.mapError(error);
    }
  }
}
