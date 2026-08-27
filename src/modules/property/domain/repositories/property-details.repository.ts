import type {
  CoordinateAccuracy,
  FurnishedStatus,
  MapProvider,
  NaturalLightingLevel,
  ParkingType,
  PropertyCondition,
  PropertyDetailsActor,
  PropertyOrientation,
  RiskLevel,
  RoomType,
  VentilationType,
} from '../property-details.js';

export type SpecificationPatch = {
  landArea?: string;
  buildingArea?: string;
  floorArea?: string;
  bedrooms?: number;
  bathrooms?: string;
  maidRooms?: number;
  guestToilets?: number;
  floors?: number;
  parkingType?: ParkingType;
  parkingSpaces?: number;
  livingRooms?: number;
  familyRooms?: number;
  diningRooms?: number;
  kitchens?: number;
  yearBuilt?: number | null;
  yearRenovated?: number | null;
  orientation?: PropertyOrientation;
  condition?: PropertyCondition;
  furnishedStatus?: FurnishedStatus;
  ceilingHeightM?: string | null;
  frontageM?: string | null;
  roadWidthM?: string | null;
};

export type LocationPatch = {
  countryUuid?: string | null;
  provinceUuid?: string | null;
  cityUuid?: string | null;
  districtUuid?: string | null;
  subdistrictUuid?: string | null;
  addressLine?: string | null;
  street?: string | null;
  building?: string | null;
  block?: string | null;
  unit?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  coordinateAccuracy?: CoordinateAccuracy;
  mapProvider?: MapProvider | null;
  placeId?: string | null;
  mapUrl?: string | null;
  floodRisk?: RiskLevel;
  earthquakeRisk?: RiskLevel;
  trafficRisk?: RiskLevel;
  noiseRisk?: RiskLevel;
  airQualityRisk?: RiskLevel;
};

export type BuildingPatch = {
  foundation?: string | null;
  structure?: string | null;
  walls?: string | null;
  roof?: string | null;
  flooring?: string | null;
  doors?: string | null;
  windows?: string | null;
  facade?: string | null;
  garden?: string | null;
  terrace?: string | null;
  balcony?: string | null;
  rooftop?: string | null;
  hasPool?: boolean;
  poolLengthM?: string | null;
  poolWidthM?: string | null;
  poolDepthM?: string | null;
  interiorStyle?: string | null;
  interiorDesign?: string | null;
  naturalLighting?: NaturalLightingLevel;
  ventilation?: VentilationType;
  smartHome?: boolean;
  soundproofing?: boolean;
};

export type RoomCreateInput = {
  roomType: RoomType;
  name: string;
  floor: number;
  area: string;
  hasBathroom?: boolean;
  hasWalkInCloset?: boolean;
  hasBalcony?: boolean;
  hasAirConditioning?: boolean;
  sortOrder?: number;
};
export type RoomUpdateInput = Partial<Omit<RoomCreateInput, 'roomType'>> & { roomType?: RoomType };

export type FacilityAssignmentInput = {
  facilityUuid: string;
  available?: boolean;
  quantity?: number | null;
  notes?: string | null;
};

export type PropertyDetailsRepository = {
  getSpecifications(propertyUuid: string): Promise<unknown>;
  upsertSpecifications(propertyUuid: string, patch: SpecificationPatch, actor: PropertyDetailsActor): Promise<unknown>;
  getLocation(propertyUuid: string): Promise<unknown>;
  updateLocation(propertyUuid: string, patch: LocationPatch, actor: PropertyDetailsActor): Promise<unknown>;
  getBuilding(propertyUuid: string): Promise<unknown>;
  updateBuilding(propertyUuid: string, patch: BuildingPatch, actor: PropertyDetailsActor): Promise<unknown>;
  listRooms(propertyUuid: string): Promise<unknown[]>;
  createRoom(propertyUuid: string, input: RoomCreateInput, actor: PropertyDetailsActor): Promise<unknown>;
  updateRoom(propertyUuid: string, roomUuid: string, patch: RoomUpdateInput, actor: PropertyDetailsActor): Promise<unknown>;
  deleteRoom(propertyUuid: string, roomUuid: string, actor: PropertyDetailsActor): Promise<void>;
  reorderRooms(propertyUuid: string, roomUuids: string[], actor: PropertyDetailsActor): Promise<unknown[]>;
  listPropertyFacilities(propertyUuid: string): Promise<unknown[]>;
  attachFacility(propertyUuid: string, input: FacilityAssignmentInput, actor: PropertyDetailsActor): Promise<unknown>;
  updateFacilityAssignment(propertyUuid: string, facilityUuid: string, patch: Omit<FacilityAssignmentInput, 'facilityUuid'>, actor: PropertyDetailsActor): Promise<unknown>;
  detachFacility(propertyUuid: string, facilityUuid: string, actor: PropertyDetailsActor): Promise<void>;
  bulkAttachFacilities(propertyUuid: string, inputs: FacilityAssignmentInput[], actor: PropertyDetailsActor): Promise<unknown[]>;
};

export const PROPERTY_DETAILS_REPOSITORY = Symbol('PROPERTY_DETAILS_REPOSITORY');
