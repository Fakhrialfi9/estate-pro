import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UserQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(['username', 'email', 'phone', 'status', 'isActive'])
  filterField?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  filterValue?: string;

  @IsOptional()
  @IsIn(['uuid', 'username', 'email', 'phone', 'status', 'createdAt', 'updatedAt'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
