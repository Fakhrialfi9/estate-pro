import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const FILTER_FIELDS = ['module', 'domain', 'action', 'isSystem'] as const;
const SORT_FIELDS = [
  'name',
  'code',
  'module',
  'domain',
  'action',
  'createdAt',
  'updatedAt',
] as const;

export class PermissionQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @IsIn(FILTER_FIELDS)
  filterField?: (typeof FILTER_FIELDS)[number];

  @ValidateIf((value: PermissionQueryDto) => value.filterField !== undefined)
  @IsString()
  @MaxLength(100)
  filterValue?: string;

  @IsString()
  @IsIn(SORT_FIELDS)
  sortBy: (typeof SORT_FIELDS)[number] = 'createdAt';

  @IsString()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}
