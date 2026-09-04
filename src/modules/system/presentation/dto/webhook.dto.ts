import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  SYSTEM_WEBHOOK_EVENTS,
  type SystemWebhookEventName,
  type WebhookFilterOperator,
} from '../../domain/webhook/webhook.contracts.js';

export class WebhookFilterDto {
  @IsString()
  @MaxLength(120)
  field!: string;

  @IsIn([
    'EQ',
    'NEQ',
    'CONTAINS',
    'IN',
    'GT',
    'GTE',
    'LT',
    'LTE',
    'EXISTS',
    'NOT_EXISTS',
  ])
  operator!: WebhookFilterOperator;

  @Allow()
  @ValidateIf((value: WebhookFilterDto) =>
    !['EXISTS', 'NOT_EXISTS'].includes(value.operator),
  )
  value?: unknown;
}

export class CreateWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  endpoint!: string;

  @IsArray()
  @IsIn([...SYSTEM_WEBHOOK_EVENTS], { each: true })
  events!: SystemWebhookEventName[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WebhookFilterDto)
  filters?: WebhookFilterDto[];
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  endpoint?: string;

  @IsOptional()
  @IsArray()
  @IsIn([...SYSTEM_WEBHOOK_EVENTS], { each: true })
  events?: SystemWebhookEventName[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WebhookFilterDto)
  filters?: WebhookFilterDto[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class WebhookListQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @Min(1)
  page = 1;

  @IsOptional()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class DeliveryListQueryDto {
  @IsOptional()
  @IsIn([
    'PENDING',
    'DELIVERING',
    'SUCCEEDED',
    'RETRYING',
    'DEAD_LETTER',
    'CANCELLED',
  ])
  state?:
    | 'PENDING'
    | 'DELIVERING'
    | 'SUCCEEDED'
    | 'RETRYING'
    | 'DEAD_LETTER'
    | 'CANCELLED';

  @IsOptional()
  @Min(1)
  page = 1;

  @IsOptional()
  @Min(1)
  @Max(100)
  limit = 20;
}
