import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
