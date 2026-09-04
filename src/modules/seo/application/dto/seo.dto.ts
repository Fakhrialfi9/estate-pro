import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePropertySeoDto {
  @IsOptional() @IsString() @MaxLength(60) title?: string | null;
  @IsOptional() @IsString() @MaxLength(160) description?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  canonicalUrl?: string | null;
  @IsOptional()
  @IsEnum([
    'INDEX_FOLLOW',
    'NOINDEX_FOLLOW',
    'INDEX_NOFOLLOW',
    'NOINDEX_NOFOLLOW',
  ] as const)
  robots?:
    | 'INDEX_FOLLOW'
    | 'NOINDEX_FOLLOW'
    | 'INDEX_NOFOLLOW'
    | 'NOINDEX_NOFOLLOW';
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  ogImageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(20) metadataVersion?: string;
}

export class UpdateContentSeoDto {
  @IsOptional() @IsString() @MaxLength(180) metaTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(320) metaDescription?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  canonicalUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(100) robots?: string | null;
  @IsOptional() @IsString() @MaxLength(180) ogTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(320) ogDescription?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  ogImageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(180) twitterTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(320) twitterDescription?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  twitterImageUrl?: string | null;
}

export class CreateRedirectDto {
  @IsString() @MaxLength(1000) sourcePath!: string;
  @IsString() @MaxLength(1000) destination!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(301) @Max(302) statusCode:
    | 301
    | 302 = 301;
}

export class SeoResourceParamsDto {
  @IsUUID('4') uuid!: string;
}
