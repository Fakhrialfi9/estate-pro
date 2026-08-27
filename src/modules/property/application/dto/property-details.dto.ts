import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  COORDINATE_ACCURACIES,
  CONDITIONS,
  FURNISHED_STATUSES,
  MAP_PROVIDERS,
  NATURAL_LIGHTING,
  ORIENTATIONS,
  PARKING_TYPES,
  RISK_LEVELS,
  ROOM_TYPES,
  VENTILATION_TYPES,
} from '../../domain/property-details.js';

const NON_NEGATIVE_DECIMAL = {
  decimal_digits: '0,2',
  force_decimal: false,
} as const;
const SIGNED_COORDINATE = {
  decimal_digits: '0,7',
  force_decimal: false,
} as const;
const DECIMAL_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;
const SIGNED_COORDINATE_PATTERN = /^-?\d{1,3}(\.\d{1,7})?$/;

export class PropertySpecificationDto {
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  landArea?: string;
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  buildingArea?: string;
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  floorArea?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) bedrooms?: number;
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  bathrooms?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) maidRooms?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) guestToilets?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) floors?: number;
  @IsOptional()
  @IsEnum(PARKING_TYPES)
  parkingType?: (typeof PARKING_TYPES)[number];
  @IsOptional() @IsInt() @Min(0) @Max(10000) parkingSpaces?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) livingRooms?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) familyRooms?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) diningRooms?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) kitchens?: number;
  @IsOptional() @IsInt() @Min(1800) @Max(2100) yearBuilt?: number | null;
  @IsOptional() @IsInt() @Min(1800) @Max(2100) yearRenovated?: number | null;
  @IsOptional()
  @IsEnum(ORIENTATIONS)
  orientation?: (typeof ORIENTATIONS)[number];
  @IsOptional() @IsEnum(CONDITIONS) condition?: (typeof CONDITIONS)[number];
  @IsOptional()
  @IsEnum(FURNISHED_STATUSES)
  furnishedStatus?: (typeof FURNISHED_STATUSES)[number];
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  ceilingHeightM?: string | null;
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  frontageM?: string | null;
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  roadWidthM?: string | null;
}

export class PropertyLocationDto {
  @IsOptional() @IsUUID('4') countryUuid?: string | null;
  @IsOptional() @IsUUID('4') provinceUuid?: string | null;
  @IsOptional() @IsUUID('4') cityUuid?: string | null;
  @IsOptional() @IsUUID('4') districtUuid?: string | null;
  @IsOptional() @IsUUID('4') subdistrictUuid?: string | null;
  @IsOptional() @IsString() @MaxLength(500) addressLine?: string | null;
  @IsOptional() @IsString() @MaxLength(200) street?: string | null;
  @IsOptional() @IsString() @MaxLength(160) building?: string | null;
  @IsOptional() @IsString() @MaxLength(80) block?: string | null;
  @IsOptional() @IsString() @MaxLength(80) unit?: string | null;
  @IsOptional() @IsString() @MaxLength(200) neighborhood?: string | null;
  @IsOptional() @IsString() @Matches(/^[0-9A-Za-z -]{3,20}$/) postalCode?:
    | string
    | null;
  @IsOptional()
  @IsString()
  @Matches(SIGNED_COORDINATE_PATTERN)
  @IsDecimal(SIGNED_COORDINATE)
  latitude?: string | null;
  @IsOptional()
  @IsString()
  @Matches(SIGNED_COORDINATE_PATTERN)
  @IsDecimal(SIGNED_COORDINATE)
  longitude?: string | null;
  @IsOptional()
  @IsEnum(COORDINATE_ACCURACIES)
  coordinateAccuracy?: (typeof COORDINATE_ACCURACIES)[number];
  @IsOptional() @IsEnum(MAP_PROVIDERS) mapProvider?:
    | (typeof MAP_PROVIDERS)[number]
    | null;
  @IsOptional() @IsString() @MaxLength(255) placeId?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  mapUrl?: string | null;
  @IsOptional() @IsEnum(RISK_LEVELS) floodRisk?: (typeof RISK_LEVELS)[number];
  @IsOptional()
  @IsEnum(RISK_LEVELS)
  earthquakeRisk?: (typeof RISK_LEVELS)[number];
  @IsOptional() @IsEnum(RISK_LEVELS) trafficRisk?: (typeof RISK_LEVELS)[number];
  @IsOptional() @IsEnum(RISK_LEVELS) noiseRisk?: (typeof RISK_LEVELS)[number];
  @IsOptional()
  @IsEnum(RISK_LEVELS)
  airQualityRisk?: (typeof RISK_LEVELS)[number];
}

export class PropertyBuildingDto {
  @IsOptional() @IsString() @MaxLength(150) foundation?: string | null;
  @IsOptional() @IsString() @MaxLength(150) structure?: string | null;
  @IsOptional() @IsString() @MaxLength(150) walls?: string | null;
  @IsOptional() @IsString() @MaxLength(150) roof?: string | null;
  @IsOptional() @IsString() @MaxLength(150) flooring?: string | null;
  @IsOptional() @IsString() @MaxLength(150) doors?: string | null;
  @IsOptional() @IsString() @MaxLength(150) windows?: string | null;
  @IsOptional() @IsString() @MaxLength(300) facade?: string | null;
  @IsOptional() @IsString() @MaxLength(300) garden?: string | null;
  @IsOptional() @IsString() @MaxLength(300) terrace?: string | null;
  @IsOptional() @IsString() @MaxLength(300) balcony?: string | null;
  @IsOptional() @IsString() @MaxLength(300) rooftop?: string | null;
  @IsOptional() @IsBoolean() hasPool?: boolean;
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  poolLengthM?: string | null;
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  poolWidthM?: string | null;
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  poolDepthM?: string | null;
  @IsOptional() @IsString() @MaxLength(150) interiorStyle?: string | null;
  @IsOptional() @IsString() @MaxLength(500) interiorDesign?: string | null;
  @IsOptional()
  @IsEnum(NATURAL_LIGHTING)
  naturalLighting?: (typeof NATURAL_LIGHTING)[number];
  @IsOptional()
  @IsEnum(VENTILATION_TYPES)
  ventilation?: (typeof VENTILATION_TYPES)[number];
  @IsOptional() @IsBoolean() smartHome?: boolean;
  @IsOptional() @IsBoolean() soundproofing?: boolean;
}

export class PropertyRoomDto {
  @IsEnum(ROOM_TYPES) roomType!: (typeof ROOM_TYPES)[number];
  @IsString() @MaxLength(150) name!: string;
  @IsInt() @Min(-20) @Max(200) floor!: number;
  @IsString()
  @Matches(/^(0|\d{1,16})(\.\d{1,2})?$/)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  area!: string;
  @IsOptional() @IsBoolean() hasBathroom?: boolean;
  @IsOptional() @IsBoolean() hasWalkInCloset?: boolean;
  @IsOptional() @IsBoolean() hasBalcony?: boolean;
  @IsOptional() @IsBoolean() hasAirConditioning?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}

export class PropertyRoomUpdateDto {
  @IsOptional() @IsEnum(ROOM_TYPES) roomType?: (typeof ROOM_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsInt() @Min(-20) @Max(200) floor?: number;
  @IsOptional()
  @IsString()
  @Matches(/^(0|\d{1,16})(\.\d{1,2})?$/)
  @IsDecimal(NON_NEGATIVE_DECIMAL)
  area?: string;
  @IsOptional() @IsBoolean() hasBathroom?: boolean;
  @IsOptional() @IsBoolean() hasWalkInCloset?: boolean;
  @IsOptional() @IsBoolean() hasBalcony?: boolean;
  @IsOptional() @IsBoolean() hasAirConditioning?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}

export class ReorderRoomsDto {
  @IsUUID('4', { each: true }) roomUuids!: string[];
}

export class FacilityAssignmentDto {
  @IsUUID('4') facilityUuid!: string;
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) quantity?: number | null;
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
}

export class FacilityAssignmentUpdateDto {
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) quantity?: number | null;
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
}

export class BulkFacilityAssignmentDto {
  @IsUUID('4', { each: true }) facilityUuids!: string[];
}
