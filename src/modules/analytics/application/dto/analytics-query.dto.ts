import { Transform, Type } from 'class-transformer';
import {
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ANALYTICS_GRANULARITIES } from '../../domain/analytics.types.js';

const trim = ({ value }: { value: unknown }): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined;

const normalizeCurrency = ({
  value,
}: {
  value: unknown;
}): string | undefined =>
  typeof value === 'string' ? value.trim().toUpperCase() : undefined;

export class AnalyticsQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsIn(ANALYTICS_GRANULARITIES)
  granularity?: (typeof ANALYTICS_GRANULARITIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @Transform(trim)
  @IsUUID()
  ownerUserUuid?: string;

  @IsOptional()
  @Transform(trim)
  @IsUUID()
  sourceUuid?: string;

  @IsOptional()
  @Transform(trim)
  @IsUUID()
  campaignUuid?: string;

  @IsOptional()
  @Transform(trim)
  @IsUUID()
  pipelineUuid?: string;

  @IsOptional()
  @Transform(trim)
  @IsUUID()
  stageUuid?: string;

  @IsOptional()
  @Transform(trim)
  @IsUUID()
  propertyUuid?: string;

  @IsOptional()
  @Transform(normalizeCurrency)
  @IsString()
  currency?: string;
}
