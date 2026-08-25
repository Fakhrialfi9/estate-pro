import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsIn(['pending', 'active', 'inactive', 'suspended'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
