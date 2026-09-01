import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  DEAL_STATUSES,
  NEGOTIATION_STATUSES,
  OFFER_STATUSES,
  VIEWING_STATUSES,
} from '../../domain/sales.types.js';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID('4')
  ownerUserUuid?: string;

  @IsOptional()
  @IsUUID('4')
  pipelineUuid?: string;

  @IsOptional()
  @IsUUID('4')
  stageUuid?: string;

  @IsOptional()
  @IsUUID('4')
  propertyUuid?: string;
}

export class PipelineDto {
  @IsString() @Length(2, 150) name!: string;
  @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

export class StageDto {
  @IsUUID('4') pipelineUuid!: string;
  @IsString() @Length(1, 60) code!: string;
  @IsString() @Length(2, 150) name!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(100) probability!: number;
  @IsOptional() @IsBoolean() isTerminal?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

export class ReorderStagesDto {
  @IsUUID('4', { each: true }) orderedStageUuids!: string[];
}

export class OpportunityCreateDto {
  @IsUUID('4') leadUuid!: string;
  @IsUUID('4') contactUuid!: string;
  @IsOptional() @IsUUID('4') ownerUserUuid?: string | null;
  @IsOptional() @IsUUID('4') teamUuid?: string | null;
  @IsOptional() @IsUUID('4') pipelineUuid?: string | null;
  @IsOptional() @IsUUID('4') stageUuid?: string | null;
  @IsOptional() @IsUUID('4') propertyUuid?: string | null;
  @IsString() @Length(2, 180) title!: string;
  @IsOptional() @IsString() @Length(1, 30) valueAmount?: string | null;
  @IsOptional() @IsString() @Length(3, 3) currency?: string | null;
  @IsString() @Length(1, 120) idempotencyKey!: string;
}

export class OpportunityUpdateDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @Length(2, 180) title?: string;
  @IsOptional() @IsUUID('4') propertyUuid?: string | null;
  @IsOptional() @IsString() @Length(1, 30) valueAmount?: string | null;
  @IsOptional() @IsString() @Length(3, 3) currency?: string | null;
}

export class AssignOpportunityDto {
  @IsOptional() @IsUUID('4') ownerUserUuid?: string | null;
  @IsOptional() @IsUUID('4') teamUuid?: string | null;
}

export class TransitionDto {
  @IsString() toStatus!: string;
  @IsOptional() @IsString() reason?: string;
}

export class AssociationDto {
  @IsUUID('4') propertyUuid!: string;
}

export class ActivityCreateDto {
  @IsUUID('4') opportunityUuid!: string;
  @IsEnum(ACTIVITY_TYPES) type!: string;
  @IsString() @Length(1, 180) subject!: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class ActivityStatusDto {
  @IsEnum(ACTIVITY_STATUSES) status!: string;
}

export class ViewingCreateDto {
  @IsUUID('4') opportunityUuid!: string;
  @IsUUID('4') propertyUuid!: string;
  @IsUUID('4') contactUuid!: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsString() notes?: string;
}

export class ViewingCommandDto {
  @IsEnum(VIEWING_STATUSES) status!: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
}

export class NegotiationCreateDto {
  @IsUUID('4') opportunityUuid!: string;
  @IsOptional() @IsString() notes?: string;
}

export class NegotiationStatusDto {
  @IsEnum(NEGOTIATION_STATUSES) status!: string;
}

export class OfferCreateDto {
  @IsUUID('4') negotiationUuid!: string;
  @IsString() @Length(1, 30) amount!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class OfferStatusDto {
  @IsEnum(OFFER_STATUSES) status!: string;
}

export class DealCreateDto {
  @IsUUID('4') opportunityUuid!: string;
  @IsUUID('4') offerUuid?: string;
  @IsString() @Length(1, 120) idempotencyKey!: string;
}

export class DealItemDto {
  @IsOptional() @IsUUID('4') propertyUuid?: string | null;
  @IsString() @Length(1, 255) description!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsString() @Length(1, 30) unitAmount!: string;
  @IsString() @Length(3, 3) currency!: string;
}

export class DealItemUpdateDto {
  @IsOptional() @IsString() @Length(1, 255) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() unitAmount?: string;
}

export class DealStatusDto {
  @IsEnum(DEAL_STATUSES) status!: string;
}

export class ClosingDto {
  @IsString() @Length(2, 40) method!: string;
  @IsDateString() closedAt!: string;
  @IsString() @Length(1, 120) idempotencyKey!: string;
}

export class LostDto {
  @IsUUID('4') reasonUuid!: string;
}

export class ReopenDto {
  @IsString() @Length(3, 1000) reason!: string;
}

export class LostReasonDto {
  @IsString() @Length(2, 60) code!: string;
  @IsString() @Length(2, 180) name!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CommissionRuleDto {
  @IsString() @Length(2, 60) code!: string;
  @IsString() @Length(2, 180) name!: string;
  @IsString() ratePercent!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CommissionCalculateDto {
  @IsUUID('4') ruleUuid!: string;
  @IsString() @Length(1, 120) idempotencyKey!: string;
}

export class ForecastQueryDto extends PageQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
