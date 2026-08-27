import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  AvailabilityStatus,
  FacilityCategory,
  PropertyStatus,
} from '../domain/property-master.types.js';
export class CatalogDto {
  @IsUUID('4') typeUuid!: string;
  @IsString() @MinLength(2) @MaxLength(50) code!: string;
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(100) icon?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}
export class CatalogUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(50) code?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(100) icon?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) version?: number;
}
export class SubcategoryDto {
  @IsUUID('4') categoryUuid!: string;
  @IsString() @MinLength(2) @MaxLength(50) code!: string;
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}
export class LocationDto {
  @IsString() @MinLength(2) @MaxLength(30) code!: string;
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(160) slug?: string;
  @IsOptional() @IsUUID('4') parentUuid?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}
export class LocationUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(30) code?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(160) slug?: string;
  @IsOptional() @IsUUID('4') parentUuid?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) version?: number;
}
export class FacilityDto {
  @IsString() @MinLength(2) @MaxLength(50) code!: string;
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @IsEnum([
    'OUTDOOR',
    'SECURITY',
    'TECHNOLOGY',
    'PARKING',
    'CLIMATE',
    'UTILITY',
    'ACCESSIBILITY',
    'RECREATION',
    'OTHER',
  ])
  category!: FacilityCategory;
  @IsOptional() @IsString() @MaxLength(100) icon?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class FacilityUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(50) code?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @IsOptional()
  @IsEnum([
    'OUTDOOR',
    'SECURITY',
    'TECHNOLOGY',
    'PARKING',
    'CLIMATE',
    'UTILITY',
    'ACCESSIBILITY',
    'RECREATION',
    'OTHER',
  ])
  category?: FacilityCategory;
  @IsOptional() @IsString() @MaxLength(100) icon?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) version?: number;
}
export class PropertyDto {
  @IsUUID('4') typeUuid!: string;
  @IsUUID('4') categoryUuid!: string;
  @IsOptional() @IsUUID('4') subcategoryUuid?: string;
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(220) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
  @IsOptional() @IsString() @MaxLength(50000) description?: string;
  @IsOptional()
  @IsEnum(['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED', 'SOLD', 'RENTED'])
  status?: PropertyStatus;
  @IsOptional()
  @IsEnum(['AVAILABLE', 'UNAVAILABLE'])
  availabilityStatus?: AvailabilityStatus;
  @IsOptional() @IsDateString() availableFrom?: string;
  @IsOptional() @IsDateString() availableTo?: string;
  @IsOptional() @IsString() @MaxLength(40) businessCode?: string;
  @IsOptional() @IsString() @MaxLength(80) referenceNumber?: string;
  @IsOptional() @IsUUID('4', { each: true }) facilityUuids?: string[];
}
export class PropertyUpdateDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(220) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
  @IsOptional() @IsString() @MaxLength(50000) description?: string;
  @IsOptional()
  @IsEnum(['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED', 'SOLD', 'RENTED'])
  status?: PropertyStatus;
  @IsOptional()
  @IsEnum(['AVAILABLE', 'UNAVAILABLE'])
  availabilityStatus?: AvailabilityStatus;
  @IsOptional() @IsDateString() availableFrom?: string;
  @IsOptional() @IsDateString() availableTo?: string;
  @IsInt() @Min(1) version!: number;
}
export class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(50) sortBy?: string;
  @IsOptional() @IsEnum(['asc', 'desc']) sortDirection?: 'asc' | 'desc';
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsUUID('4') parentUuid?: string;
  @IsOptional() @IsUUID('4') typeUuid?: string;
  @IsOptional() @IsUUID('4') categoryUuid?: string;
  @IsOptional() @IsUUID('4') subcategoryUuid?: string;
  @IsOptional()
  @IsEnum(['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED', 'SOLD', 'RENTED'])
  status?: PropertyStatus;
  @IsOptional()
  @IsEnum([
    'OUTDOOR',
    'SECURITY',
    'TECHNOLOGY',
    'PARKING',
    'CLIMATE',
    'UTILITY',
    'ACCESSIBILITY',
    'RECREATION',
    'OTHER',
  ])
  category?: FacilityCategory;
}
