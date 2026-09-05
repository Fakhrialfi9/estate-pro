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

const DASHBOARD_GRANULARITIES = ['day', 'week', 'month'] as const;

type DashboardGranularity = (typeof DASHBOARD_GRANULARITIES)[number];

const trim = ({ value }: { value: unknown }): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined;

const normalizeCurrency = ({
  value,
}: {
  value: unknown;
}): string | undefined =>
  typeof value === 'string' ? value.trim().toUpperCase() : undefined;

/**
 * Dashboard owns its public query boundary. The contract intentionally mirrors
 * the analytics filters without importing Analytics internals across modules.
 */
export class ExecutiveDashboardQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsIn(DASHBOARD_GRANULARITIES)
  granularity?: DashboardGranularity;

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
