import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ListingPaymentDto } from './listing-payment.dto.js';
import { ListingPriceDto } from './listing-price.dto.js';
import {
  LISTING_STATUSES,
  LISTING_TRANSACTION_TYPES,
  LISTING_VISIBILITIES,
  PROPERTY_OWNER_TYPES,
  type ListingStatus,
  type ListingTransactionType,
  type ListingVisibility,
  type PropertyOwnerType,
} from '../domain/listing.types.js';

export class CreateListingDto {
  @IsUUID('4') propertyUuid!: string;
  @IsString() @MinLength(3) @MaxLength(80) listingCode!: string;
  @IsEnum(LISTING_TRANSACTION_TYPES) transactionType!: ListingTransactionType;
  @IsOptional() @IsEnum(LISTING_VISIBILITIES) visibility?: ListingVisibility;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() premium?: boolean;
  @IsOptional() @IsISO8601() expiresAt?: string | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => ListingPriceDto)
  @ApiProperty({ required: false, type: () => ListingPriceDto })
  price?: ListingPriceDto;
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ListingPaymentDto)
  @ApiProperty({
    required: false,
    type: () => ListingPaymentDto,
    isArray: true,
  })
  payments?: ListingPaymentDto[];
}

export class UpdateListingDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(80) listingCode?: string;
  @IsOptional()
  @IsEnum(LISTING_TRANSACTION_TYPES)
  transactionType?: ListingTransactionType;
  @IsOptional() @IsEnum(LISTING_VISIBILITIES) visibility?: ListingVisibility;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() premium?: boolean;
  @IsOptional() @IsISO8601() expiresAt?: string | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => ListingPriceDto)
  @ApiProperty({ required: false, type: () => ListingPriceDto })
  price?: ListingPriceDto;
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ListingPaymentDto)
  @ApiProperty({
    required: false,
    type: () => ListingPaymentDto,
    isArray: true,
  })
  payments?: ListingPaymentDto[];
}

export class ListingWorkflowDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(100) reason?: string;
}

export class AgentAssignmentDto {
  @IsUUID('4') agentUserUuid!: string;
  @IsString() @MinLength(1) @MaxLength(160) agentDisplayName!: string;
  @IsOptional() @IsBoolean() primary?: boolean;
}

export class ChangeAgentDto extends AgentAssignmentDto {
  @IsUUID('4') assignmentUuid!: string;
}

export class OwnerAssignmentDto {
  @IsEnum(PROPERTY_OWNER_TYPES) ownerType!: PropertyOwnerType;
  @IsString() @MinLength(2) @MaxLength(160) ownerDisplayName!: string;
}

const csv = (value: unknown): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : value;

const bool = (value: unknown): unknown =>
  typeof value === 'string' ? value === 'true' : value;

export class PropertySearchDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsUUID('4') typeUuid?: string;
  @IsOptional() @IsUUID('4') categoryUuid?: string;
  @IsOptional() @IsUUID('4') subcategoryUuid?: string;
  @IsOptional() @IsUUID('4') countryUuid?: string;
  @IsOptional() @IsUUID('4') provinceUuid?: string;
  @IsOptional() @IsUUID('4') cityUuid?: string;
  @IsOptional() @IsUUID('4') districtUuid?: string;
  @IsOptional() @IsString() minPrice?: string;
  @IsOptional() @IsString() maxPrice?: string;
  @IsOptional() @IsString() minLandArea?: string;
  @IsOptional() @IsString() maxLandArea?: string;
  @IsOptional() @IsString() minBuildingArea?: string;
  @IsOptional() @IsString() maxBuildingArea?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minBedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxBedrooms?: number;
  @IsOptional() @IsString() minBathrooms?: string;
  @IsOptional() @IsString() maxBathrooms?: string;
  @IsOptional()
  @Transform(({ value }) => csv(value))
  @IsUUID('4', { each: true })
  facilityUuids?: string[];
  @IsOptional()
  @IsEnum(LISTING_TRANSACTION_TYPES)
  transactionType?: ListingTransactionType;
  @IsOptional() @IsEnum(LISTING_STATUSES) listingStatus?: ListingStatus;
  @IsOptional()
  @Transform(({ value }) => bool(value))
  @IsBoolean()
  featured?: boolean;
  @IsOptional()
  @Transform(({ value }) => bool(value))
  @IsBoolean()
  verified?: boolean;
  @IsOptional()
  @IsEnum(['price', 'createdAt', 'updatedAt', 'views', 'featured'])
  sortBy?: 'price' | 'createdAt' | 'updatedAt' | 'views' | 'featured';
  @IsOptional() @IsEnum(['asc', 'desc']) sortDirection?: 'asc' | 'desc';
}
