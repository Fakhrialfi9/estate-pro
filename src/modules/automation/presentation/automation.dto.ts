import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ACTION_TYPES, TRIGGER_TYPES } from '../domain/automation.types.js';

export class CreateAutomationWorkflowDto {
  @ApiProperty({ maxLength: 180 }) @IsString() @MaxLength(180) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @ApiProperty() @IsUUID() ownerUserUuid!: string;
}

export class UpdateAutomationWorkflowDto {
  @ApiPropertyOptional({ maxLength: 180 }) @IsOptional() @IsString() @MaxLength(180) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;
}

export class CreateAutomationVersionDto {
  @ApiProperty({ enum: [...TRIGGER_TYPES] }) @IsString() @IsIn([...TRIGGER_TYPES]) triggerType!: string;
  @ApiProperty({ type: Object }) definition!: Record<string, unknown>;
}

export class DispatchAutomationEventDto {
  @ApiProperty() @IsUUID() eventId!: string;
  @ApiProperty({ enum: ['LEAD', 'CONTACT', 'OPPORTUNITY', 'DEAL', 'ACTIVITY', 'SLA'] }) @IsString() entityType!: string;
  @ApiProperty() @IsUUID() entityUuid!: string;
  @ApiProperty() @IsInt() @Min(1) version!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() payload?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorUuid?: string;
}

export class CreateAssignmentRuleDto {
  @ApiProperty() @IsString() @MaxLength(180) name!: string;
  @ApiProperty({ type: Object }) criteria!: Record<string, unknown>;
  @ApiProperty({ enum: ['ROUND_ROBIN', 'FIXED_USER', 'FIXED_TEAM', 'LEAST_LOAD'] }) strategy!: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() fallback?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() activeFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() activeUntil?: string;
  @ApiPropertyOptional() @IsOptional() isActive?: boolean;
}

export class CreateSlaPolicyDto {
  @ApiProperty() @IsString() @MaxLength(180) name!: string;
  @ApiProperty() @IsString() targetEntityType!: string;
  @ApiProperty() @IsString() startEventType!: string;
  @ApiProperty({ type: [String] }) @IsArray() stopEventTypes!: string[];
  @ApiProperty() @IsInt() @Min(1) @Max(525600) durationMinutes!: number;
  @ApiPropertyOptional({ default: 'UTC' }) @IsOptional() @IsString() timezone?: string;
  @ApiProperty({ type: Object }) businessHours!: Record<string, unknown>;
}

export class CreateEscalationPolicyDto {
  @ApiProperty() @IsString() @MaxLength(180) name!: string;
  @ApiProperty({ type: [Object] }) @IsArray() levels!: Record<string, unknown>[];
  @ApiPropertyOptional({ default: 3 }) @IsOptional() @IsInt() @Min(1) @Max(10) maxAttempts?: number;
  @ApiPropertyOptional({ default: 3600 }) @IsOptional() @IsInt() @Min(1) @Max(604800) cooldownSeconds?: number;
}

export class PageAutomationQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityUuid?: string;
}
