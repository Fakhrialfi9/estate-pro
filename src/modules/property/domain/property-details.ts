export type PropertyDetailsActor = {
  readonly actorUuid?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
};

export const ORIENTATIONS = [
  'NORTH','NORTHEAST','EAST','SOUTHEAST','SOUTH','SOUTHWEST','WEST','NORTHWEST','UNKNOWN',
] as const;
export type PropertyOrientation = (typeof ORIENTATIONS)[number];
export const CONDITIONS = ['NEW','GOOD','FAIR','NEEDS_RENOVATION','RENOVATED'] as const;
export type PropertyCondition = (typeof CONDITIONS)[number];
export const FURNISHED_STATUSES = ['UNFURNISHED','SEMI_FURNISHED','FULLY_FURNISHED'] as const;
export type FurnishedStatus = (typeof FURNISHED_STATUSES)[number];
export const PARKING_TYPES = ['NONE','CARPORT','GARAGE','OPEN_PARKING','STREET_PARKING','MIXED'] as const;
export type ParkingType = (typeof PARKING_TYPES)[number];
export const ROOM_TYPES = ['MASTER_BEDROOM','BEDROOM','LIVING_ROOM','FAMILY_ROOM','DINING_ROOM','KITCHEN','BATHROOM','GUEST_TOILET','MAID_ROOM','STUDY','OFFICE','PLAYROOM','STORAGE','LAUNDRY','PRAYER_ROOM','OTHER'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const COORDINATE_ACCURACIES = ['ROOFTOP','RANGE_INTERPOLATED','GEOMETRIC_CENTER','APPROXIMATE','UNKNOWN'] as const;
export type CoordinateAccuracy = (typeof COORDINATE_ACCURACIES)[number];
export const MAP_PROVIDERS = ['GOOGLE_MAPS','MAPBOX','OPENSTREETMAP','APPLE_MAPS','OTHER'] as const;
export type MapProvider = (typeof MAP_PROVIDERS)[number];
export const RISK_LEVELS = ['UNKNOWN','LOW','MODERATE','HIGH','VERY_HIGH'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const NATURAL_LIGHTING = ['EXCELLENT','GOOD','MODERATE','LIMITED','NONE'] as const;
export type NaturalLightingLevel = (typeof NATURAL_LIGHTING)[number];
export const VENTILATION_TYPES = ['NATURAL','MECHANICAL','MIXED','NONE'] as const;
export type VentilationType = (typeof VENTILATION_TYPES)[number];

export class PropertyDetailNotFoundError extends Error {}
export class PropertyDetailConflictError extends Error {}
export class PropertyDetailInvalidStateError extends Error {}

const numberValue = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : null;
};

export const assertNonNegative = (name: string, value: string | number | null | undefined): void => {
  const n = numberValue(value);
  if (n !== null && n < 0) throw new PropertyDetailInvalidStateError(`${name} must be greater than or equal to zero`);
};

export const assertPositive = (name: string, value: string | number): void => {
  const n = numberValue(value);
  if (n === null || n <= 0) throw new PropertyDetailInvalidStateError(`${name} must be greater than zero`);
};

export const assertYearRange = (name: string, value: number | null | undefined): void => {
  if (value === null || value === undefined) return;
  const year = new Date().getUTCFullYear();
  if (!Number.isInteger(value) || value < 1800 || value > year) {
    throw new PropertyDetailInvalidStateError(`${name} must be between 1800 and the current year`);
  }
};

export const assertSpecificationInvariants = (input: {
  landArea?: string | number | null;
  buildingArea?: string | number | null;
  floorArea?: string | number | null;
  bedrooms?: number;
  bathrooms?: string | number;
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
  ceilingHeightM?: string | number | null;
  frontageM?: string | number | null;
  roadWidthM?: string | number | null;
}): void => {
  assertNonNegative('landArea', input.landArea);
  assertNonNegative('buildingArea', input.buildingArea);
  assertNonNegative('floorArea', input.floorArea);
  assertNonNegative('bathrooms', input.bathrooms);
  assertNonNegative('ceilingHeightM', input.ceilingHeightM);
  assertNonNegative('frontageM', input.frontageM);
  assertNonNegative('roadWidthM', input.roadWidthM);
  for (const [name, value] of Object.entries({
    bedrooms: input.bedrooms, maidRooms: input.maidRooms, guestToilets: input.guestToilets,
    parkingSpaces: input.parkingSpaces, livingRooms: input.livingRooms, familyRooms: input.familyRooms,
    diningRooms: input.diningRooms, kitchens: input.kitchens,
  })) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new PropertyDetailInvalidStateError(`${name} must be an integer greater than or equal to zero`);
    }
  }
  if (input.floors !== undefined && (!Number.isInteger(input.floors) || input.floors <= 0)) {
    throw new PropertyDetailInvalidStateError('floors must be greater than zero');
  }
  assertYearRange('yearBuilt', input.yearBuilt);
  assertYearRange('yearRenovated', input.yearRenovated);
  if (input.yearBuilt !== null && input.yearBuilt !== undefined && input.yearRenovated !== null && input.yearRenovated !== undefined && input.yearRenovated < input.yearBuilt) {
    throw new PropertyDetailInvalidStateError('yearRenovated must be greater than or equal to yearBuilt');
  }
  const building = numberValue(input.buildingArea);
  const land = numberValue(input.landArea);
  if (building !== null && land !== null && building > land) {
    throw new PropertyDetailInvalidStateError('buildingArea must not exceed landArea');
  }
  const parkingType = input.parkingType ?? 'NONE';
  const parkingSpaces = input.parkingSpaces ?? 0;
  if (parkingType === 'NONE' && parkingSpaces > 0) {
    throw new PropertyDetailInvalidStateError('parkingSpaces must be zero when parkingType is NONE');
  }
};

export const assertCoordinatePair = (latitude: string | number | null | undefined, longitude: string | number | null | undefined): void => {
  const lat = numberValue(latitude);
  const lng = numberValue(longitude);
  if ((lat === null) !== (lng === null)) throw new PropertyDetailInvalidStateError('latitude and longitude must be provided together');
  if (lat !== null && (lat < -90 || lat > 90)) throw new PropertyDetailInvalidStateError('latitude must be between -90 and 90');
  if (lng !== null && (lng < -180 || lng > 180)) throw new PropertyDetailInvalidStateError('longitude must be between -180 and 180');
};

export const assertLocationHierarchy = (levels: Array<string | null | undefined>): void => {
  const names = ['countryUuid','provinceUuid','cityUuid','districtUuid','subdistrictUuid'];
  let missingFound = false;
  levels.forEach((value, index) => {
    if (!value) missingFound = true;
    if (value && missingFound) throw new PropertyDetailInvalidStateError(`${names[index]} cannot be supplied when a parent level is missing`);
  });
};

export const assertPoolInvariants = (input: {
  hasPool: boolean;
  poolLengthM?: string | number | null;
  poolWidthM?: string | number | null;
  poolDepthM?: string | number | null;
}): void => {
  const dimensions = [input.poolLengthM, input.poolWidthM, input.poolDepthM];
  if (!input.hasPool && dimensions.some((value) => value !== null && value !== undefined && value !== '')) {
    throw new PropertyDetailInvalidStateError('pool dimensions are only valid when hasPool is true');
  }
  if (input.hasPool) dimensions.forEach((value, index) => assertPositive(['poolLengthM','poolWidthM','poolDepthM'][index], value as string | number));
};

export const assertRoomInvariants = (input: { floor: number; area: string | number }): void => {
  if (!Number.isInteger(input.floor)) throw new PropertyDetailInvalidStateError('floor must be an integer');
  assertPositive('area', input.area);
};
