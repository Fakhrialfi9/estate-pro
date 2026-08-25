import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, AUDIT_RESULT_VALUES } from '../../../../common/audit/audit-events.js';

const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS);

export class AuditLogQueryDto {
  @IsOptional()
  @IsUUID('4')
  actorUuid?: string;

  @IsOptional()
  @IsIn(AUDIT_ACTION_VALUES)
  action?: string;

  @IsOptional()
  @IsIn(AUDIT_RESOURCE_TYPES)
  resourceType?: (typeof AUDIT_RESOURCE_TYPES)[number];

  @IsOptional()
  @IsIn(AUDIT_RESULT_VALUES)
  result?: (typeof AUDIT_RESULT_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

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
  limit = 50;
}
