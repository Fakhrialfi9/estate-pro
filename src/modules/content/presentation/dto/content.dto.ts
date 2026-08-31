import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsUUID,
} from 'class-validator';
import {
  CONTENT_FORMATS,
  CONTENT_STATUSES,
  VISIBILITIES,
  ARTICLE_TYPES,
} from '../../domain/content.types.js';

export class ArticleCreateDto {
  @IsString() @MinLength(1) @MaxLength(220) title!: string;
  @IsOptional() @IsString() @MaxLength(240) slug?: string;
  @IsOptional() @IsString() @MaxLength(300) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(5000) excerpt?: string;
  @IsDefined() content!: unknown;
  @IsOptional()
  @IsEnum(CONTENT_FORMATS)
  contentFormat?: (typeof CONTENT_FORMATS)[number];
  @IsOptional() @IsEnum(ARTICLE_TYPES) type?: (typeof ARTICLE_TYPES)[number];
  @IsOptional()
  @IsEnum(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number];
  @IsOptional() @IsString() @MaxLength(12) language?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() allowComments?: boolean;
  @IsOptional() @IsUUID() categoryUuid?: string;
  @IsOptional() @IsUUID() coverMediaUuid?: string;
  @IsOptional() @IsUUID() authorUuid?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) tagUuids?: string[];
  @IsOptional() @IsObject() seo?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(500) changeSummary?: string;
}

export class ArticleUpdateDto extends ArticleCreateDto {
  @IsOptional() @IsInt() @Min(1) version?: number;
}

export class ContentQueryDto {
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional()
  @IsEnum(CONTENT_STATUSES)
  status?: (typeof CONTENT_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(12) language?: string;
  @IsOptional()
  @IsEnum([
    'createdAt',
    'updatedAt',
    'publishedAt',
    'sortOrder',
    'priority',
    'title',
  ])
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'publishedAt'
    | 'sortOrder'
    | 'priority'
    | 'title';
  @IsOptional() @IsEnum(['asc', 'desc']) sortDirection?: 'asc' | 'desc';
}

export class ResourceDto {
  @IsOptional() @IsString() @MaxLength(500) name?: string;
  @IsOptional() @IsString() @MaxLength(220) title?: string;
  @IsOptional() @IsString() @MaxLength(240) slug?: string;
  @IsOptional() @IsString() @MaxLength(80) template?: string;
  @IsOptional() content?: unknown;
  @IsOptional() @IsString() @MaxLength(300) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) question?: string;
  @IsOptional() answer?: unknown;
  @IsOptional() quote?: unknown;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(120) role?: string;
  @IsOptional() @IsString() @MaxLength(180) company?: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  avatarUrl?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsInt() @Min(-100000) @Max(100000) sortOrder?: number;
  @IsOptional() @IsInt() @Min(-100000) @Max(100000) priority?: number;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() allowComments?: boolean;
  @IsOptional()
  @IsEnum(CONTENT_STATUSES)
  status?: (typeof CONTENT_STATUSES)[number];
  @IsOptional()
  @IsEnum(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number];
  @IsOptional() @IsString() @MaxLength(12) language?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsString() @MaxLength(40) placement?: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  linkUrl?: string;
  @IsOptional() @IsString() @MaxLength(80) location?: string;
  @IsOptional() @IsArray() items?: unknown[];
  @IsOptional() @IsString() @MaxLength(1000) sourcePath?: string;
  @IsOptional() @IsString() @MaxLength(1000) destination?: string;
  @IsOptional() @IsString() @MaxLength(30) contentFormat?: string;
}

export class PublishDto {
  @IsOptional() @IsDateString() scheduledAt?: string;
}
export class ReorderMenuDto {
  @IsArray() @IsUUID('4', { each: true }) itemUuids!: string[];
}
export class RelationDto {
  @IsUUID() sourceUuid!: string;
  @IsUUID() targetUuid!: string;
  @IsString() sourceType!: string;
  @IsString() targetType!: string;
  @IsOptional() @IsString() relationType?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class CommentDto {
  @IsDefined() content!: unknown;
  @IsOptional() @IsString() @MaxLength(180) authorName?: string;
  @IsOptional() @IsEmail() @MaxLength(320) authorEmail?: string;
  @IsOptional() @IsUUID() parentUuid?: string;
}
export class ModerationDto {
  @IsEnum(['APPROVED', 'REJECTED', 'SPAM', 'DELETED']) status!:
    | 'APPROVED'
    | 'REJECTED'
    | 'SPAM'
    | 'DELETED';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
