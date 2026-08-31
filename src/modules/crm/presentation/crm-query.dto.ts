import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CrmPageQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'displayName', 'score', 'code'])
  sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
}
export class LeadQueryDto extends CrmPageQueryDto {
  @IsOptional() @IsUUID() statusUuid?: string;
  @IsOptional() @IsUUID() sourceUuid?: string;
  @IsOptional() @IsUUID() typeUuid?: string;
  @IsOptional() @IsUUID() ownerUserUuid?: string;
}
export class InquiryQueryDto extends CrmPageQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'PROPERTY_INQUIRY',
    'CONTACT_MESSAGE',
    'PRICE_REQUEST',
    'CALLBACK_REQUEST',
    'CONSULTATION',
    'BROCHURE_REQUEST',
    'VIEWING_REQUEST',
  ])
  intent?: string;
  @IsOptional()
  @IsString()
  @IsIn(['NEW', 'IN_PROGRESS', 'CONVERTED', 'CLOSED', 'SPAM'])
  status?: string;
  @IsOptional() @IsUUID() propertyUuid?: string;
  @IsOptional() @IsUUID() leadUuid?: string;
}
export class ActivityQueryDto extends CrmPageQueryDto {
  @IsOptional()
  @IsIn(['TASK', 'FOLLOW_UP', 'CALL', 'MEETING', 'REMINDER', 'NOTE'])
  type?: string;
  @IsOptional()
  @IsIn(['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: string;
  @IsOptional() @IsUUID() leadUuid?: string;
  @IsOptional() @IsUUID() contactUuid?: string;
  @IsOptional() @IsUUID() assigneeUserUuid?: string;
}
export class CommunicationQueryDto extends CrmPageQueryDto {
  @IsOptional() @IsIn(['EMAIL', 'WHATSAPP', 'SMS']) channel?: string;
  @IsOptional()
  @IsIn(['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'])
  status?: string;
  @IsOptional() @IsUUID() leadUuid?: string;
  @IsOptional() @IsUUID() contactUuid?: string;
}
