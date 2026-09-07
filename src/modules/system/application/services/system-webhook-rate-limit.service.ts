import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SYSTEM_WEBHOOK_RATE_LIMIT_REPOSITORY,
  type SystemWebhookRateLimitRepository,
} from '../../domain/webhook/webhook-rate-limit.repository.js';

@Injectable()
export class SystemWebhookRateLimitService {
  constructor(
    @Inject(SYSTEM_WEBHOOK_RATE_LIMIT_REPOSITORY)
    private readonly repository: SystemWebhookRateLimitRepository,
    private readonly config: ConfigService,
  ) {}

  async consume(subscriptionUuid: string): Promise<void> {
    const now = Date.now();
    const windowMs = Math.max(
      1000,
      this.config.get<number>('system.webhook.rateWindowMs', 60_000),
    );
    const bucketStart = new Date(Math.floor(now / windowMs) * windowMs);
    const limit = Math.max(
      1,
      this.config.get<number>('system.webhook.rateLimit', 60),
    );
    const result = await this.repository.consume(
      subscriptionUuid,
      bucketStart,
      limit,
    );
    if (!result.allowed)
      throw new ForbiddenException('Webhook rate limit exceeded');
  }
}
