import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TRIGGER_TYPES, type TriggerType } from '../domain/automation.types.js';

type AutomationEntityType =
  | 'LEAD'
  | 'CONTACT'
  | 'OPPORTUNITY'
  | 'DEAL'
  | 'ACTIVITY'
  | 'SLA';
type AssignmentStrategy =
  | 'ROUND_ROBIN'
  | 'FIXED_USER'
  | 'FIXED_TEAM'
  | 'LEAST_LOAD';
type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'INVALID';
type ExecutionState =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DEAD_LETTER';

export class CreateAutomationWorkflowDto {
  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty()
  @IsUUID()
  ownerUserUuid!: string;
}

export class UpdateAutomationWorkflowDto {
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}

export class CreateAutomationVersionDto {
  @ApiProperty({ enum: [...TRIGGER_TYPES] })
  @IsString()
  @IsIn([...TRIGGER_TYPES])
  triggerType!: TriggerType;

  @ApiProperty({ type: Object })
  @IsObject()
  definition!: Record<string, unknown>;
}

export class DispatchAutomationEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  eventId!: string;

  @ApiProperty({
    enum: ['LEAD', 'CONTACT', 'OPPORTUNITY', 'DEAL', 'ACTIVITY', 'SLA'],
  })
  @IsString()
  entityType!: AutomationEntityType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  entityUuid!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUuid?: string;
}

export class CreateAssignmentRuleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  criteria!: Record<string, unknown>;

  @ApiProperty({
    enum: ['ROUND_ROBIN', 'FIXED_USER', 'FIXED_TEAM', 'LEAST_LOAD'],
  })
  @IsString()
  @IsIn(['ROUND_ROBIN', 'FIXED_USER', 'FIXED_TEAM', 'LEAST_LOAD'])
  strategy!: AssignmentStrategy;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  fallback?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activeFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activeUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSlaPolicyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiProperty()
  @IsString()
  targetEntityType!: string;

  @ApiProperty()
  @IsString()
  startEventType!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stopEventTypes?: string[];

  @ApiProperty({ minimum: 1, maximum: 525600 })
  @IsInt()
  @Min(1)
  @Max(525600)
  durationMinutes!: number;

  @ApiPropertyOptional({ default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  businessHours?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateEscalationPolicyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiProperty({ type: [Object], minItems: 1, maxItems: 10 })
  @IsArray()
  @IsObject({ each: true })
  levels!: Record<string, unknown>[];

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @ApiPropertyOptional({ minimum: 1, default: 3600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cooldownSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PageAutomationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'INVALID'],
  })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'INVALID'])
  status?: WorkflowStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowUuid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'PENDING',
    'RUNNING',
    'WAITING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'DEAD_LETTER',
  ])
  state?: ExecutionState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityUuid?: string;
}
