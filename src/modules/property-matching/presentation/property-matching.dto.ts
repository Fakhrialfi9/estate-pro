import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FEEDBACK_TYPES, HARD_CRITERIA, MATCHING_SUBJECT_TYPES, type HardCriterion, type MatchFeedbackType, type MatchingSubjectType, type PropertyPreferenceState } from '../domain/matching.types.js';

type TransactionType = PropertyPreferenceState['transactionTypes'][number];
type FurnishedStatus = NonNullable<NonNullable<PropertyPreferenceState['specification']>['furnishedStatus']>;
type PropertyCondition = NonNullable<NonNullable<PropertyPreferenceState['specification']>['condition']>;
type PriceFrequency = NonNullable<PropertyPreferenceState['budget']>['frequency'];

class IntRangeDto {
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) @Max(100) min?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) @Max(100) max?: number;
}
class DecimalRangeDto {
  @ApiPropertyOptional({ example: '500000000' }) @IsOptional() @IsString() min?: string;
  @ApiPropertyOptional({ example: '1000000000' }) @IsOptional() @IsString() max?: string;
}
class LocationPreferenceDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('4') countryUuid?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('4') provinceUuid?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('4') cityUuid?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('4') districtUuid?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('4') subdistrictUuid?: string;
  @ApiPropertyOptional({ minimum: 0.1, maximum: 500 }) @IsOptional() @IsNumber() @Min(0.1) @Max(500) radiusKm?: number;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
}
class BudgetPreferenceDto {
  @ApiPropertyOptional({ example: '500000000' }) @IsOptional() @IsString() min?: string;
  @ApiPropertyOptional({ example: '1500000000' }) @IsOptional() @IsString() max?: string;
  @ApiProperty({ example: 'IDR' }) @IsString() currency!: string;
  @ApiProperty({ enum: ['TOTAL', 'PER_MONTH', 'PER_YEAR', 'PER_DAY'] }) @IsEnum(['TOTAL', 'PER_MONTH', 'PER_YEAR', 'PER_DAY']) frequency!: PriceFrequency;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 }) @IsOptional() @IsNumber() @Min(0) @Max(100) tolerancePercent?: number;
}
class SpecificationPreferenceDto {
  @ApiPropertyOptional({ type: IntRangeDto }) @IsOptional() @ValidateNested() @Type(() => IntRangeDto) bedrooms?: IntRangeDto;
  @ApiPropertyOptional({ type: DecimalRangeDto }) @IsOptional() @ValidateNested() @Type(() => DecimalRangeDto) bathrooms?: DecimalRangeDto;
  @ApiPropertyOptional({ type: DecimalRangeDto }) @IsOptional() @ValidateNested() @Type(() => DecimalRangeDto) areaSqm?: DecimalRangeDto;
  @ApiPropertyOptional({ type: IntRangeDto }) @IsOptional() @ValidateNested() @Type(() => IntRangeDto) parkingSpaces?: IntRangeDto;
  @ApiPropertyOptional({ enum: ['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'] }) @IsOptional() @IsEnum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']) furnishedStatus?: FurnishedStatus;
  @ApiPropertyOptional({ enum: ['NEW', 'GOOD', 'FAIR', 'NEEDS_RENOVATION', 'RENOVATED'] }) @IsOptional() @IsEnum(['NEW', 'GOOD', 'FAIR', 'NEEDS_RENOVATION', 'RENOVATED']) condition?: PropertyCondition;
}
export class PreferenceDto {
  @ApiProperty({ enum: MATCHING_SUBJECT_TYPES }) @IsEnum(MATCHING_SUBJECT_TYPES) subjectType!: MatchingSubjectType;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') subjectUuid!: string;
  @ApiProperty({ enum: ['SALE', 'RENT', 'LEASE', 'AUCTION', 'JOINT_VENTURE', 'OTHER'], isArray: true }) @IsArray() @ArrayUnique() @IsEnum(['SALE', 'RENT', 'LEASE', 'AUCTION', 'JOINT_VENTURE', 'OTHER'], { each: true }) transactionTypes!: TransactionType[];
  @ApiProperty({ type: String, isArray: true }) @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) propertyTypeUuids!: string[];
  @ApiProperty({ type: String, isArray: true }) @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) propertyCategoryUuids!: string[];
  @ApiPropertyOptional({ type: LocationPreferenceDto }) @IsOptional() @ValidateNested() @Type(() => LocationPreferenceDto) location?: LocationPreferenceDto;
  @ApiPropertyOptional({ type: BudgetPreferenceDto }) @IsOptional() @ValidateNested() @Type(() => BudgetPreferenceDto) budget?: BudgetPreferenceDto;
  @ApiPropertyOptional({ type: SpecificationPreferenceDto }) @IsOptional() @ValidateNested() @Type(() => SpecificationPreferenceDto) specification?: SpecificationPreferenceDto;
  @ApiProperty({ enum: HARD_CRITERIA, isArray: true }) @IsArray() @ArrayUnique() @IsEnum(HARD_CRITERIA, { each: true }) hardCriteria!: HardCriterion[];
}
export class UpdatePreferenceDto extends PartialType(PreferenceDto) {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
}
export class SubjectParamsDto {
  @ApiProperty({ enum: MATCHING_SUBJECT_TYPES }) @IsEnum(MATCHING_SUBJECT_TYPES) subjectType!: MatchingSubjectType;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') subjectUuid!: string;
}
export class MatchQueryDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 35 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) minScore?: number;
  @ApiPropertyOptional({ minimum: 1, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
export class RecommendationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
export class GenerateRecommendationDto extends MatchQueryDto {
  @ApiProperty({ enum: MATCHING_SUBJECT_TYPES }) @IsEnum(MATCHING_SUBJECT_TYPES) subjectType!: MatchingSubjectType;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') subjectUuid!: string;
}
export class FeedbackDto {
  @ApiProperty({ enum: MATCHING_SUBJECT_TYPES }) @IsEnum(MATCHING_SUBJECT_TYPES) subjectType!: MatchingSubjectType;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') subjectUuid!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') recommendationItemUuid!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') propertyUuid!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') listingUuid!: string;
  @ApiProperty({ enum: FEEDBACK_TYPES }) @IsEnum(FEEDBACK_TYPES) feedback!: MatchFeedbackType;
}