import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PageDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'displayName', 'score', 'code'])
  sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
}
export class ContactDto {
  @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsString() @MinLength(1) @MaxLength(220) displayName!: string;
  @IsOptional() @IsString() @MaxLength(180) companyName?: string;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @IsUUID() ownerUserUuid?: string;
  @IsOptional() @IsString() @MaxLength(80) source?: string;
}
export class ContactPatchDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(220) displayName?: string;
  @IsOptional() @IsString() @MaxLength(180) companyName?: string | null;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string | null;
}
export class AddressDto {
  @IsString() @MaxLength(30) type!: string;
  @IsString() @MinLength(1) @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MinLength(1) @MaxLength(100) city!: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(30) postalCode?: string;
  @IsString() @Length(2, 2) @Matches(/^[A-Za-z]{2}$/) countryCode!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class ContactChildPatchDto {
  @IsOptional() @IsString() @MaxLength(30) type?: string;
  @IsOptional() @IsString() @MaxLength(200) line1?: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string | null;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string | null;
  @IsOptional() @IsString() @MaxLength(30) postalCode?: string | null;
  @IsOptional() @IsString() @MaxLength(40) value?: string;
}
export class PhoneDto {
  @IsString() @MaxLength(30) type!: string;
  @IsString() @MinLength(3) @MaxLength(40) value!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class EmailDto {
  @IsString() @MaxLength(30) type!: string;
  @IsEmail() @MaxLength(254) value!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class PreferenceDto {
  @IsOptional()
  @IsIn(['EMAIL', 'SMS', 'WHATSAPP', 'CALL'])
  preferredChannel?: string;
  @IsOptional() @IsString() @MaxLength(10) preferredLanguage?: string;
  @IsOptional() @IsBoolean() marketingEmail?: boolean;
  @IsOptional() @IsBoolean() marketingSms?: boolean;
  @IsOptional() @IsBoolean() marketingWhatsapp?: boolean;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursStart?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursEnd?: string;
  @IsOptional() @IsString() @MaxLength(50) timezone?: string;
}
export class ConsentDto {
  @IsString() @MaxLength(50) consentType!: string;
  @IsIn(['GRANTED', 'REVOKED']) status!: string;
  @IsString() @MinLength(1) @MaxLength(80) source!: string;
}
export class RelationshipDto {
  @IsUUID() targetContactUuid!: string;
  @IsString() @MinLength(1) @MaxLength(50) relationshipType!: string;
  @IsOptional() @IsBoolean() isReciprocal?: boolean;
}
export class LeadDto {
  @IsUUID() contactUuid!: string;
  @IsUUID() sourceUuid!: string;
  @IsUUID() typeUuid!: string;
  @IsOptional() @IsUUID() campaignUuid?: string;
  @IsOptional() @IsUUID() statusUuid?: string;
  @IsOptional() @IsString() @MaxLength(60) code?: string;
}
export class LeadPatchDto {
  @IsOptional() @IsString() @MaxLength(60) code?: string;
  @IsOptional() @IsUUID() campaignUuid?: string;
}
export class ConfigDto {
  @IsString() @MaxLength(80) code!: string;
  @IsString() @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isClosed?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(20) color?: string | null;
  @IsOptional() @IsUUID() sourceUuid?: string;
  @IsOptional() @IsISO8601() startsAt?: string | null;
  @IsOptional() @IsISO8601() endsAt?: string | null;
}
export class ConfigPatchDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsBoolean() isClosed?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() @MaxLength(20) color?: string | null;
}
export class NoteDto {
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}
export class AssignmentDto {
  @IsUUID() userUuid!: string;
}
export class StatusDto {
  @IsUUID() statusUuid!: string;
}
export class ScoreRuleDto {
  @IsString() @MaxLength(80) code!: string;
  @IsIn(['displayName', 'source', 'status', 'type', 'ownerUserUuid', 'score'])
  field!: string;
  @IsIn(['EQ', 'NEQ', 'CONTAINS', 'GT', 'GTE', 'LT', 'LTE', 'TRUE', 'FALSE'])
  operator!: string;
  @IsString() @MaxLength(200) value!: string;
  @IsInt() @Min(-1000) @Max(1000) points!: number;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class DuplicateReviewDto {
  @IsIn(['CONFIRMED', 'IGNORED']) status!: string;
}
export class MergeDto {
  @IsUUID() targetLeadUuid!: string;
}
export class InquiryDto {
  @IsIn([
    'PROPERTY_INQUIRY',
    'CONTACT_MESSAGE',
    'PRICE_REQUEST',
    'CALLBACK_REQUEST',
    'CONSULTATION',
    'BROCHURE_REQUEST',
    'VIEWING_REQUEST',
  ])
  intent!: string;
  @IsOptional() @IsUUID() contactUuid?: string;
  @IsOptional() @IsUUID() propertyUuid?: string;
  @IsOptional() @IsString() @MaxLength(160) requesterName?: string;
  @IsOptional() @IsEmail() @MaxLength(254) requesterEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) requesterPhone?: string;
  @IsOptional() @IsString() @MaxLength(10000) message?: string;
  @IsOptional()
  @IsIn(['EMAIL', 'SMS', 'WHATSAPP', 'CALL'])
  preferredChannel?: string;
  @IsOptional() @IsISO8601() preferredAt?: string;
  @IsOptional() @IsString() @MaxLength(50) timezone?: string;
  @IsOptional() @IsString() @MaxLength(30) deliveryPreference?: string;
  @IsOptional() @IsString() @MaxLength(255) serviceContext?: string;
  @IsOptional() @IsString() @MaxLength(100) website?: string;
  @IsOptional() @IsString() @MaxLength(500) captchaToken?: string;
}
export class InquiryPatchDto {
  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'CONVERTED', 'CLOSED', 'SPAM'])
  status?: string;
  @IsOptional() @IsUUID() contactUuid?: string;
  @IsOptional() @IsString() @MaxLength(10000) message?: string;
}
export class ConversionDto {
  @IsUUID() sourceUuid!: string;
  @IsUUID() typeUuid!: string;
  @IsUUID() statusUuid!: string;
  @IsOptional() @IsString() @MaxLength(60) code?: string;
}
export class ActivityDto {
  @IsIn(['TASK', 'FOLLOW_UP', 'CALL', 'MEETING', 'REMINDER', 'NOTE'])
  type!: string;
  @IsString() @MinLength(1) @MaxLength(180) subject!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsUUID() contactUuid?: string;
  @IsOptional() @IsUUID() leadUuid?: string;
  @IsOptional() @IsUUID() assigneeUserUuid?: string;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: string;
  @IsOptional() @IsISO8601() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(80) callOutcome?: string;
  @IsOptional() @IsInt() @Min(0) @Max(86400) durationSeconds?: number;
  @IsOptional() @IsISO8601() meetingStartAt?: string;
  @IsOptional() @IsISO8601() meetingEndAt?: string;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsISO8601() reminderAt?: string;
}
export class ActivityPatchDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(180) subject?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsISO8601() dueAt?: string | null;
  @IsOptional() @IsUUID() assigneeUserUuid?: string | null;
}
export class ActivityStatusDto {
  @IsIn(['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status!: string;
}
export class CommunicationDto {
  @IsIn(['EMAIL', 'WHATSAPP', 'SMS']) channel!: string;
  @IsOptional() @IsIn(['INBOUND', 'OUTBOUND']) direction?: string;
  @IsOptional() @IsUUID() contactUuid?: string;
  @IsOptional() @IsUUID() leadUuid?: string;
  @IsOptional() @IsUUID() activityUuid?: string;
  @IsOptional() @IsUUID() templateUuid?: string;
  @IsOptional() @IsString() @MaxLength(60) providerName?: string;
  @IsString() @MaxLength(254) destination!: string;
  @IsOptional() @IsString() @MaxLength(255) subject?: string;
  @IsString() @MaxLength(10000) body!: string;
}
export class CommunicationStatusDto {
  @IsIn(['SENT', 'DELIVERED', 'FAILED', 'CANCELLED']) status!: string;
  @IsOptional() @IsString() @MaxLength(160) providerMessageId?: string;
  @IsOptional() @IsString() @MaxLength(500) providerError?: string;
}
export class TemplateDto {
  @IsString() @MaxLength(80) code!: string;
  @IsString() @MaxLength(150) name!: string;
  @IsIn(['EMAIL', 'WHATSAPP', 'SMS']) channel!: string;
  @IsOptional() @IsString() @MaxLength(255) subject?: string | null;
  @IsString() @MaxLength(10000) body!: string;
}
export class TemplatePatchDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(255) subject?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) body?: string;
}
