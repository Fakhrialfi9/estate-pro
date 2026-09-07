export const SYSTEM_WEBHOOK_RATE_LIMIT_REPOSITORY = Symbol(
  'SYSTEM_WEBHOOK_RATE_LIMIT_REPOSITORY',
);

export interface SystemWebhookRateLimitRepository {
  consume(
    subscriptionUuid: string,
    bucketStart: Date,
    limit: number,
  ): Promise<{ allowed: boolean; requestCount: number; blockedCount: number }>;
}
