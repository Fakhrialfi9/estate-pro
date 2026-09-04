import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SettingsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 25;
}

export class UpdateSettingDto {
  @IsString()
  value!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  expectedVersion?: number;
}
