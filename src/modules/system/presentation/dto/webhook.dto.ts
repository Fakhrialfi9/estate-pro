import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import { SYSTEM_WEBHOOK_EVENTS, type SystemWebhookEventName } from '../../domain/webhook/webhook.contracts.js';

export class CreateWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  endpoint!: string;

  @IsArray()
  @IsIn([...SYSTEM_WEBHOOK_EVENTS], { each: true })
  events!: SystemWebhookEventName[];
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
  @IsIn(['PENDING', 'DELIVERING', 'SUCCEEDED', 'RETRYING', 'DEAD_LETTER', 'CANCELLED'])
  state?: 'PENDING' | 'DELIVERING' | 'SUCCEEDED' | 'RETRYING' | 'DEAD_LETTER' | 'CANCELLED';

  @IsOptional()
  @Min(1)
  page = 1;

  @IsOptional()
  @Min(1)
  @Max(100)
  limit = 20;
}
