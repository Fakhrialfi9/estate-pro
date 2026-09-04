import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  @MaxLength(80)
  providerKey!: string;

  @IsString()
  @MaxLength(40)
  providerVersion!: string;

  @IsObject()
  metadata!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  secretRef?: string;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  secretRef?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class IntegrationListQueryDto {
  @IsOptional()
  @IsIn(['CONFIGURED', 'ACTIVE', 'DISABLED', 'ERROR', 'DISCONNECTED'])
  state?: 'CONFIGURED' | 'ACTIVE' | 'DISABLED' | 'ERROR' | 'DISCONNECTED';

  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
