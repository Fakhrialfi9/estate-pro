import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const EXPORT_COLUMNS = [
  'uuid',
  'actorUuid',
  'eventType',
  'category',
  'resourceType',
  'resourceUuid',
  'summary',
  'metadata',
  'requestId',
  'createdAt',
] as const;

export class ExportDto {
  @IsIn(['system_activity'])
  entity = 'system_activity' as const;

  @IsIn(['csv', 'json', 'xlsx'])
  format!: 'csv' | 'json' | 'xlsx';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  limit = 10000;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  eventType?: string;

  @IsOptional()
  @IsIn(['createdAt_asc', 'createdAt_desc'])
  sort?: 'createdAt_asc' | 'createdAt_desc';

  @IsOptional()
  @IsIn(EXPORT_COLUMNS, { each: true })
  columns?: (typeof EXPORT_COLUMNS)[number][];
}

export class ExportQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'])
  state?: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
}
