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

const FILTER_FIELDS = ['name', 'code', 'isActive', 'isSystem'] as const;
const SORT_FIELDS = ['name', 'code', 'createdAt', 'updatedAt'] as const;

export class RoleQueryDto {
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

  @ValidateIf((value: RoleQueryDto) => value.filterField !== undefined)
  @IsString()
  @MaxLength(100)
  filterValue?: string;

  @IsString()
  @IsIn(SORT_FIELDS)
  sortBy: (typeof SORT_FIELDS)[number] = 'createdAt';

  @IsString()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
