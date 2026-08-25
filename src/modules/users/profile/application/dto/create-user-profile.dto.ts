import { IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

export class CreateUserProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  avatarThumbnailUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  locale?: string;
}
