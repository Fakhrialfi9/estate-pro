import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class PasswordResetRequestDto {
  @IsEmail()
  @MaxLength(191)
  email!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  confirmation!: string;
}
