import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CERTIFICATE_STATUSES,
  CERTIFICATE_TYPES,
  INVESTMENT_RATINGS,
  LEGAL_OWNERSHIP_STATUSES,
  LEGAL_OWNERSHIP_TYPES,
  LEGAL_VERIFICATION_STATUSES,
  MEDIA_CATEGORIES,
  MEDIA_TYPES,
  ROBOTS_POLICIES,
  UTILITY_BACKUP_POWER_TYPES,
  UTILITY_DRAINAGE_CONDITIONS,
  UTILITY_DRAINAGE_TYPES,
  UTILITY_GAS_TYPES,
  UTILITY_SEWAGE_TYPES,
  UTILITY_WATER_SOURCES,
} from '../../domain/property-extras.js';
import type { JsonValue } from '../../domain/property-extras.js';
const D2 = /^\d{1,18}(?:\.\d{1,2})?$/;
const R4 = /^\d{1,4}(?:\.\d{1,4})?$/;
export class PropertyUtilityDto {
  @IsOptional() @IsString() @MaxLength(120) electricityProvider?: string | null;
  @IsOptional() @IsString() @Matches(D2) electricityCapacityKva?: string | null;
  @IsOptional() @IsString() @MaxLength(32) electricityMeterNumberMasked?:
    string | null;
  @IsOptional()
  @IsEnum(UTILITY_WATER_SOURCES)
  waterSource?: (typeof UTILITY_WATER_SOURCES)[number];
  @IsOptional() @IsEnum(UTILITY_WATER_SOURCES) waterBackupSource?:
    (typeof UTILITY_WATER_SOURCES)[number] | null;
  @IsOptional()
  @IsEnum(UTILITY_GAS_TYPES)
  gasType?: (typeof UTILITY_GAS_TYPES)[number];
  @IsOptional() @IsBoolean() internetFiber?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  internetProviders?: string[] | null;
  @IsOptional()
  @IsEnum(UTILITY_SEWAGE_TYPES)
  sewageType?: (typeof UTILITY_SEWAGE_TYPES)[number];
  @IsOptional()
  @IsEnum(UTILITY_DRAINAGE_TYPES)
  drainageType?: (typeof UTILITY_DRAINAGE_TYPES)[number];
  @IsOptional()
  @IsEnum(UTILITY_DRAINAGE_CONDITIONS)
  drainageCondition?: (typeof UTILITY_DRAINAGE_CONDITIONS)[number];
  @IsOptional()
  @IsEnum(UTILITY_BACKUP_POWER_TYPES)
  backupPowerType?: (typeof UTILITY_BACKUP_POWER_TYPES)[number];
  @IsOptional() @IsString() @Matches(D2) backupPowerCapacityKva?: string | null;
}
export class PropertyLegalDto {
  @IsOptional()
  @IsEnum(LEGAL_OWNERSHIP_TYPES)
  ownershipType?: (typeof LEGAL_OWNERSHIP_TYPES)[number];
  @IsOptional()
  @IsEnum(LEGAL_OWNERSHIP_STATUSES)
  ownershipStatus?: (typeof LEGAL_OWNERSHIP_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(160) ownerReference?: string | null;
  @IsOptional()
  @IsEnum(LEGAL_VERIFICATION_STATUSES)
  verificationStatus?: (typeof LEGAL_VERIFICATION_STATUSES)[number];
  @IsOptional() @IsDateString() verifiedAt?: string | null;
  @IsOptional() @IsString() @MaxLength(120) verificationSource?: string | null;
  @IsOptional() @IsString() @MaxLength(120) zoningZone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) allowedUse?: string | null;
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}(?:\.\d{1,4})?$/)
  buildingCoverageRatio?: string | null;
  @IsOptional() @IsString() @Matches(R4) floorAreaRatio?: string | null;
  @IsOptional() @IsObject() disputes?: Record<string, JsonValue> | null;
  @IsOptional() @IsObject() encumbrances?: Record<string, JsonValue> | null;
}
export class PropertyCertificateDto {
  @IsEnum(CERTIFICATE_TYPES) type!: (typeof CERTIFICATE_TYPES)[number];
  @IsString() @MaxLength(100) number!: string;
  @IsOptional()
  @IsEnum(CERTIFICATE_STATUSES)
  status?: (typeof CERTIFICATE_STATUSES)[number];
  @IsOptional() @IsDateString() issueDate?: string | null;
  @IsOptional() @IsDateString() expiryDate?: string | null;
  @IsOptional() @IsString() @MaxLength(200) issuer?: string | null;
}
export class PropertyCertificateUpdateDto {
  @IsOptional()
  @IsEnum(CERTIFICATE_TYPES)
  type?: (typeof CERTIFICATE_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(100) number?: string;
  @IsOptional()
  @IsEnum(CERTIFICATE_STATUSES)
  status?: (typeof CERTIFICATE_STATUSES)[number];
  @IsOptional() @IsDateString() issueDate?: string | null;
  @IsOptional() @IsDateString() expiryDate?: string | null;
  @IsOptional() @IsString() @MaxLength(200) issuer?: string | null;
}
export class PropertyFinancialDto {
  @IsOptional() @IsString() @Matches(D2) askingPrice?: string | null;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsBoolean() negotiable?: boolean;
  @IsOptional() @IsString() @Matches(D2) annualPropertyTax?: string | null;
  @IsOptional() @IsString() @Matches(D2) monthlyMaintenance?: string | null;
  @IsOptional() @IsString() @Matches(D2) monthlyUtilityCost?: string | null;
  @IsOptional() @IsString() @Matches(D2) monthlyServiceCharges?: string | null;
  @IsOptional() @IsString() @Matches(R4) rentalYield?: string | null;
  @IsOptional() @IsString() @Matches(D2) annualRentalIncome?: string | null;
  @IsOptional() @IsString() @Matches(R4) capitalGrowth?: string | null;
  @IsOptional()
  @IsEnum(INVESTMENT_RATINGS)
  investmentRating?: (typeof INVESTMENT_RATINGS)[number];
}
export class PropertyFeaturesDto {
  @IsOptional() @IsBoolean() petFriendly?: boolean;
  @IsOptional() @IsBoolean() childFriendly?: boolean;
  @IsOptional() @IsBoolean() wheelchairAccessible?: boolean;
  @IsOptional() @IsBoolean() elderlyFriendly?: boolean;
  @IsOptional() @IsBoolean() smokingAllowed?: boolean;
  @IsOptional() @IsBoolean() eventsAllowed?: boolean;
  @IsOptional() @IsBoolean() rentalAllowed?: boolean;
}
export class PropertySecurityDto {
  @IsOptional() @IsBoolean() securityGuard?: boolean;
  @IsOptional() @IsBoolean() cctv?: boolean;
  @IsOptional() @IsBoolean() accessControl?: boolean;
  @IsOptional() @IsBoolean() gatedCommunity?: boolean;
  @IsOptional() @IsBoolean() smartLock?: boolean;
  @IsOptional() @IsBoolean() alarmSystem?: boolean;
}
export class PropertyEnvironmentDto {
  @IsOptional() @IsBoolean() greenBuilding?: boolean;
  @IsOptional() @IsBoolean() solarPower?: boolean;
  @IsOptional() @IsBoolean() rainwaterHarvesting?: boolean;
  @IsOptional() @IsBoolean() waterSaving?: boolean;
  @IsOptional() @IsString() @MaxLength(200) greenCertification?: string | null;
}
export class PropertySeoDto {
  @IsOptional() @IsString() @MaxLength(60) title?: string | null;
  @IsOptional() @IsString() @MaxLength(160) description?: string | null;
  @IsOptional() keywords?: JsonValue | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  canonicalUrl?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  ogImageUrl?: string | null;
  @IsOptional()
  @IsEnum(ROBOTS_POLICIES)
  robots?: (typeof ROBOTS_POLICIES)[number];
  @IsOptional() @IsString() @MaxLength(20) metadataVersion?: string;
  @IsOptional() @IsString() @MaxLength(80) schemaType?: string | null;
  @IsOptional() @IsString() @MaxLength(120) source?: string | null;
  @IsOptional() tags?: JsonValue | null;
  @IsOptional() @IsObject() customFields?: Record<string, JsonValue> | null;
}
export class PropertyMediaDto {
  @IsEnum(MEDIA_TYPES) type!: (typeof MEDIA_TYPES)[number];
  @IsOptional()
  @IsEnum(MEDIA_CATEGORIES)
  category?: (typeof MEDIA_CATEGORIES)[number];
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  thumbnailUrl?: string | null;
  @IsString() @MaxLength(120) mimeType!: string;
  @IsOptional() @IsString() @Matches(/^\.?[A-Za-z0-9]{1,10}$/) extension?:
    string | null;
  @IsOptional() @IsInt() @Min(0) @Max(524288000) fileSizeBytes?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(50000) widthPx?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(50000) heightPx?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(86400000) durationMs?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isCover?: boolean;
  @IsOptional() @IsObject() metadata?: Record<string, JsonValue> | null;
  @IsOptional() @IsString() @MaxLength(80) provider?: string | null;
  @IsOptional() @IsString() @MaxLength(500) storageKey?: string | null;
}
export class PropertyMediaUpdateDto {
  @IsOptional() @IsEnum(MEDIA_TYPES) type?: (typeof MEDIA_TYPES)[number];
  @IsOptional()
  @IsEnum(MEDIA_CATEGORIES)
  category?: (typeof MEDIA_CATEGORIES)[number];
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url?: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  thumbnailUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(120) mimeType?: string;
  @IsOptional() @IsString() @Matches(/^\.?[A-Za-z0-9]{1,10}$/) extension?:
    string | null;
  @IsOptional() @IsInt() @Min(0) @Max(524288000) fileSizeBytes?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(50000) widthPx?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(50000) heightPx?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(86400000) durationMs?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isCover?: boolean;
  @IsOptional() @IsObject() metadata?: Record<string, JsonValue> | null;
  @IsOptional() @IsString() @MaxLength(80) provider?: string | null;
  @IsOptional() @IsString() @MaxLength(500) storageKey?: string | null;
}
export class ReorderMediaDto {
  @IsArray() @ArrayMaxSize(1000) mediaUuids!: string[];
}
