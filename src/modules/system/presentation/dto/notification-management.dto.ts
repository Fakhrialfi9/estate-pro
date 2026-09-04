import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class NotificationPreferenceDto {
  @IsString()
  @MaxLength(50)
  notificationType!: string;

  @IsIn(['IN_APP', 'EMAIL', 'WHATSAPP', 'SMS'])
  channel!: 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'SMS';

  @IsBoolean()
  enabled!: boolean;
}

export class NotificationTemplateDto {
  @IsString()
  @MaxLength(80)
  code!: string;
  @IsInt()
  @Min(1)
  @Max(10000)
  version!: number;
  @IsString()
  @MaxLength(180)
  titleTemplate!: string;
  @IsString()
  @MaxLength(10000)
  bodyTemplate!: string;
  @IsOptional()
  variables?: string[];
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class NotificationTemplateUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  titleTemplate?: string;
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  bodyTemplate?: string;
  @IsOptional()
  variables?: string[];
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class NotificationPolicyDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  templateUuid?: string | null;
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class NotificationDeliveryDto {
  @IsIn(['IN_APP', 'EMAIL', 'WHATSAPP', 'SMS'])
  channel!: 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'SMS';
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;
}
