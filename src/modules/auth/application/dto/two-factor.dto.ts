import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class TwoFactorVerifyDto {
  @IsString()
  challengeToken!: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  code?: string;
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-fA-F]{32}$/)
  recoveryCode?: string;
}

export class DisableTwoFactorDto {
  @IsString()
  @MinLength(8)
  password!: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  code?: string;
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-fA-F]{32}$/)
  recoveryCode?: string;
}

export class VerifyEnrollmentDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class RegenerateRecoveryCodesDto {
  @IsString()
  @MinLength(8)
  password!: string;
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
