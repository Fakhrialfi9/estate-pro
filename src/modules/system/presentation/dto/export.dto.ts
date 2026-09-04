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

export class ExportDto {
  @IsIn(['system_activity'])
  entity: 'system_activity' = 'system_activity';

  @IsIn(['csv', 'json'])
  format!: 'csv' | 'json';

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
  @IsIn(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'])
  state?: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
}
