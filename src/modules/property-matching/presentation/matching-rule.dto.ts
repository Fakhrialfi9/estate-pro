import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { MATCHING_RULE_WEIGHT_KEYS } from '../domain/matching-rule.js';

export class MatchingRuleWeightsDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) transactionType?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) propertyType?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) propertyCategory?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) budget?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) location?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bedrooms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bathrooms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) areaSqm?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) parkingSpaces?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) furnishedStatus?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) condition?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) behavior?: number;

  toRecord() {
    const source = this as Record<string, unknown>;
    return Object.fromEntries(
      MATCHING_RULE_WEIGHT_KEYS
        .filter((key) => source[key] !== undefined)
        .map((key) => [key, source[key]]),
    );
  }
}

export class CreateMatchingRuleDto {
  @IsString() @Matches(/^[A-Za-z0-9_. -]{1,120}$/) name!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  version?: number;

  @IsOptional() @Type(() => MatchingRuleWeightsDto)
  weights?: MatchingRuleWeightsDto;

  @IsOptional() @IsString({ each: true }) @MaxLength(40, { each: true })
  hardCriteria?: string[];

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  minimumScore?: number;

  @IsOptional() @IsBoolean() activate?: boolean;
}

export class UpdateMatchingRuleDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) version!: number;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_. -]{1,120}$/) name?: string;
  @IsOptional() @Type(() => MatchingRuleWeightsDto)
  weights?: MatchingRuleWeightsDto;
  @IsOptional() @IsString({ each: true }) @MaxLength(40, { each: true })
  hardCriteria?: string[];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  minimumScore?: number;
}
