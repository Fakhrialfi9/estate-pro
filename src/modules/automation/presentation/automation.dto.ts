import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { TRIGGER_TYPES } from '../domain/automation.types.js';

export class CreateAutomationWorkflowDto {
  @ApiProperty({ maxLength: 180 }) @IsString() @MaxLength(180) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
  @ApiProperty() @IsUUID() ownerUserUuid!: string;
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
  triggerType!: string;
  @ApiProperty({ type: Object }) definition!: Record<string, unknown>;
}

export class DispatchAutomationEventDto {
  @ApiProperty() @IsUUID() eventId!: string;
  @ApiProperty({
    enum: ['LEAD', 'CONTACT', 'OPPORTUNITY', 'DEAL', 'ACTIVITY', 'SLA'],
  })
  @IsString()
  entityType!: string;
  @ApiProperty() @IsUUID() entityUuid!: string;
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() payload?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorUuid?: string;
}

export class CreateAssignmentRuleDto {
  @ApiProperty() @IsString() @MaxLength(180) name!: string;
  @ApiProperty({ type: Object }) criteria!: Record<string, unknown>;
  @ApiProperty({
    enum: ['ROUND_ROBIN', 'FIXED_USER', 'FIXED_TEAM', 'LEAST_LOAD'],
  })
  strategy!: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() fallback?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional() @IsOptional() @IsString() activeFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() activeUntil?: string;
  @ApiPropertyOptional() @IsOptional() isActive?: boolean;
}
