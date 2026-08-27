import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class PropertyTypeQueryDto {
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
  limit = 20;

  @IsOptional()
  @IsIn(['code', 'name', 'slug', 'isActive'])
  filterField?: 'code' | 'name' | 'slug' | 'isActive';

  @IsOptional()
  @IsString()
  @Length(1, 100)
  filterValue?: string;

  @IsOptional()
  @IsIn([
    'code',
    'name',
    'slug',
    'isActive',
    'sortOrder',
    'createdAt',
    'updatedAt',
  ])
  sortBy:
    | 'code'
    | 'name'
    | 'slug'
    | 'isActive'
    | 'sortOrder'
    | 'createdAt'
    | 'updatedAt' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
}
