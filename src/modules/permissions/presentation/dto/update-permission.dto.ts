import { IsOptional, IsString, Length } from 'class-validator';

export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;
}
