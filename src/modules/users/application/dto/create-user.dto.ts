import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ValidateIf(
    (o: CreateUserDto) => o.username !== undefined && o.username !== null,
  )
  username?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  @ValidateIf((o: CreateUserDto) => o.email !== undefined && o.email !== null)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @ValidateIf((o: CreateUserDto) => o.phone !== undefined && o.phone !== null)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}
