import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type {
  ImportTargetField,
  ImportTransform,
} from '../../domain/import/import-mapping.contracts.js';

export class ImportColumnMappingDto {
  @IsString()
  @MaxLength(160)
  sourceColumn!: string;

  @IsString()
  @IsIn([
    'eventType',
    'category',
    'summary',
    'resourceType',
    'resourceUuid',
    'metadata',
    'requestId',
  ])
  targetField!: ImportTargetField;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class ImportFieldMappingDto {
  @IsString()
  @IsIn([
    'eventType',
    'category',
    'summary',
    'resourceType',
    'resourceUuid',
    'metadata',
    'requestId',
  ])
  targetField!: ImportTargetField;

  @IsArray()
  @IsString({ each: true })
  @IsIn(
    [
      'trim',
      'lowercase',
      'uppercase',
      'null-if-empty',
      'number',
      'boolean',
      'date',
    ],
    { each: true },
  )
  transforms!: ImportTransform[];
}
