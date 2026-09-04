import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AMENITY_CATEGORIES,
  DOCUMENT_CLASSIFICATIONS,
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  HISTORY_EVENTS,
} from '../../domain/property-capabilities.js';

export class CreateAmenityDto {
  @IsString() @MinLength(2) @MaxLength(80) @Matches(/^[A-Za-z0-9_]+$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEnum(AMENITY_CATEGORIES) category!: (typeof AMENITY_CATEGORIES)[number];
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}

export class UpdateAmenityDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) @Matches(/^[A-Za-z0-9_]+$/) code?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(AMENITY_CATEGORIES) category?: (typeof AMENITY_CATEGORIES)[number];
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}

export class AssignAmenityDto {
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsString() @MaxLength(120) value?: string | null;
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
}

export class CreateDocumentDto {
  @IsEnum(DOCUMENT_CLASSIFICATIONS) classification!: (typeof DOCUMENT_CLASSIFICATIONS)[number];
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsEnum(DOCUMENT_VISIBILITIES) visibility!: (typeof DOCUMENT_VISIBILITIES)[number];
  @IsEnum(DOCUMENT_STATUSES) status!: (typeof DOCUMENT_STATUSES)[number];
  @IsOptional() @IsISO8601() retentionUntil?: string | null;
  @IsOptional() @IsString() @MaxLength(80) storageProvider?: string | null;
  @IsString() @MinLength(1) @MaxLength(500) @Matches(/^[^/\\][^\r\n]*$/) storageKey!: string;
  @IsString() @MinLength(3) @MaxLength(120) @Matches(/^[\w.+-]+\/[\w.+-]+$/) mimeType!: string;
  @IsOptional() @IsString() @MaxLength(20) @Matches(/^[A-Za-z0-9]+$/) extension?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(4294967295) fileSizeBytes?: number | null;
  @IsString() @Matches(/^[a-fA-F0-9]{64}$/) checksumSha256!: string;
}

export class CreateDocumentVersionDto {
  @IsOptional() @IsString() @MaxLength(80) storageProvider?: string | null;
  @IsString() @MinLength(1) @MaxLength(500) @Matches(/^[^/\\][^\r\n]*$/) storageKey!: string;
  @IsString() @MinLength(3) @MaxLength(120) @Matches(/^[\w.+-]+\/[\w.+-]+$/) mimeType!: string;
  @IsOptional() @IsString() @MaxLength(20) @Matches(/^[A-Za-z0-9]+$/) extension?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(4294967295) fileSizeBytes?: number | null;
  @IsString() @Matches(/^[a-fA-F0-9]{64}$/) checksumSha256!: string;
}

export class UpdateDocumentDto {
  @IsOptional() @IsEnum(DOCUMENT_CLASSIFICATIONS) classification?: (typeof DOCUMENT_CLASSIFICATIONS)[number];
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsEnum(DOCUMENT_VISIBILITIES) visibility?: (typeof DOCUMENT_VISIBILITIES)[number];
  @IsOptional() @IsEnum(DOCUMENT_STATUSES) status?: (typeof DOCUMENT_STATUSES)[number];
  @IsOptional() @IsISO8601() retentionUntil?: string | null;
}

export class CreateHistoryDto {
  @IsEnum(HISTORY_EVENTS) event!: (typeof HISTORY_EVENTS)[number];
  @IsString() @MinLength(2) @MaxLength(255) summary!: string;
  @IsOptional() @IsArray() changes?: Array<{
    field: string;
    oldValue: string | number | boolean | null;
    newValue: string | number | boolean | null;
  }>;
}

export class HistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsEnum(HISTORY_EVENTS) event?: (typeof HISTORY_EVENTS)[number];
}
