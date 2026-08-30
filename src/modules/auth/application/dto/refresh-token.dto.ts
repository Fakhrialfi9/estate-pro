import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { REFRESH_TOKEN_STRING_LENGTH } from '../services/refresh-token-crypto.service.js';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @Length(REFRESH_TOKEN_STRING_LENGTH, REFRESH_TOKEN_STRING_LENGTH)
  @Matches(/^[A-Za-z0-9_-]+$/)
  refreshToken!: string;
}
