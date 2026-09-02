import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum AgentStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}
export enum AvailabilityStatusDto {
  ACTIVE = 'ACTIVE',
  UNAVAILABLE = 'UNAVAILABLE',
  LEAVE = 'LEAVE',
  OFFLINE = 'OFFLINE',
}
export enum CoverageLevelDto {
  COUNTRY = 'COUNTRY',
  PROVINCE = 'PROVINCE',
  CITY = 'CITY',
  DISTRICT = 'DISTRICT',
  SUBDISTRICT = 'SUBDISTRICT',
}
export enum TargetPeriodDto {
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
  CUSTOM = 'CUSTOM',
}
export enum TargetStatusDto {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export class AgentCreateDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') userUuid!: string;
  @ApiPropertyOptional({ maxLength: 220 })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  displayName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hireDate?: Date;
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumberMasked?: string;
  @ApiPropertyOptional({ default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timeZone?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxActiveAssignments?: number;
}
export class AgentUpdateDto {
  @ApiPropertyOptional({ maxLength: 220 })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  displayName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;
  @ApiPropertyOptional({ enum: AgentStatusDto })
  @IsOptional()
  @IsEnum(AgentStatusDto)
  status?: AgentStatusDto;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hireDate?: Date;
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumberMasked?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timeZone?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxActiveAssignments?: number;
}
export class SpecializationCreateDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  code!: string;
  @ApiProperty({ maxLength: 150 }) @IsString() @MaxLength(150) name!: string;
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class CoverageCreateDto {
  @ApiProperty({ enum: CoverageLevelDto })
  @IsEnum(CoverageLevelDto)
  level!: CoverageLevelDto;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') regionUuid!: string;
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  label?: string;
}
export class ScheduleItemDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;
  @ApiProperty({ example: '09:00' })
  @IsString()
  @MinLength(5)
  @MaxLength(5)
  startTime!: string;
  @ApiProperty({ example: '17:00' })
  @IsString()
  @MinLength(5)
  @MaxLength(5)
  endTime!: string;
}
export class AvailabilityExceptionDto {
  @ApiProperty({ enum: AvailabilityStatusDto })
  @IsEnum(AvailabilityStatusDto)
  status!: AvailabilityStatusDto;
  @ApiProperty({ format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;
  @ApiProperty({ format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
export class AvailabilityUpdateDto {
  @ApiProperty({ enum: AvailabilityStatusDto })
  @IsEnum(AvailabilityStatusDto)
  status!: AvailabilityStatusDto;
  @ApiPropertyOptional({ default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timeZone?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveAt?: Date;
  @ApiProperty({ type: [ScheduleItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedule!: ScheduleItemDto[];
  @ApiProperty({ type: [AvailabilityExceptionDto] })
  @ValidateNested({ each: true })
  @Type(() => AvailabilityExceptionDto)
  exceptions!: AvailabilityExceptionDto[];
}
export class AssignmentCreateDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') propertyUuid!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') agentUuid!: string;
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
export class ReassignmentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') toAgentUuid!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  fromAgentUuid?: string;
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
export class TargetCreateDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  metricType!: string;
  @ApiProperty({ enum: TargetPeriodDto })
  @IsEnum(TargetPeriodDto)
  periodType!: TargetPeriodDto;
  @ApiProperty({ format: 'date' })
  @Type(() => Date)
  @IsDate()
  periodStart!: Date;
  @ApiProperty({ format: 'date' }) @Type(() => Date) @IsDate() periodEnd!: Date;
  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000000)
  targetValue!: number;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  scope?: string;
}
export class TargetUpdateDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetValue?: number;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  scope?: string;
  @ApiPropertyOptional({ enum: TargetStatusDto })
  @IsOptional()
  @IsEnum(TargetStatusDto)
  status?: TargetStatusDto;
}
