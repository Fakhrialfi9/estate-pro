import type { ImportState } from '../../domain/system-public.contracts.js';
import {
  IsArray,
  IsBase64,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ImportColumnMappingDto,
  ImportFieldMappingDto,
} from './import-mapping.dto.js';

export class ImportDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsBase64()
  contentBase64!: string;

  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  preview?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportColumnMappingDto)
  columnMapping?: ImportColumnMappingDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportFieldMappingDto)
  fieldMapping?: ImportFieldMappingDto[];

  @IsOptional()
  @IsIn(['FAIL', 'SKIP', 'UPDATE', 'UPSERT'])
  conflictStrategy?: 'FAIL' | 'SKIP' | 'UPDATE' | 'UPSERT';

  @IsOptional()
  @IsIn(['ROW', 'BATCH', 'ALL_OR_NOTHING'])
  transactionStrategy?: 'ROW' | 'BATCH' | 'ALL_OR_NOTHING';
}

export class ImportQueryDto {
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
  @IsIn(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'RETRYABLE'])
  state?: ImportState;
}
