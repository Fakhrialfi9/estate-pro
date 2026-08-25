import { Type } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

const ROLE_CODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export class CreateRoleDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(1, 100)
  @Matches(ROLE_CODE_PATTERN, { message: 'code must use lowercase kebab-case' })
  code!: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  @Type(() => String)
  description?: string | null;
}
