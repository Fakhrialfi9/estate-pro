import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { SystemWebhookRateLimitRepository } from '../../domain/webhook/webhook-rate-limit.repository.js';

@Injectable()
export class PrismaSystemWebhookRateLimitRepository
  implements SystemWebhookRateLimitRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async consume(
    subscriptionUuid: string,
    bucketStart: Date,
    limit: number,
  ): Promise<{ allowed: boolean; requestCount: number; blockedCount: number }> {
    const subscription = await this.prisma.systemWebhookSubscription.findUnique(
      {
        where: { uuid: subscriptionUuid },
        select: { id: true },
      },
    );
    if (!subscription)
      throw new NotFoundException('Webhook subscription not found');

    return this.prisma.$transaction(async (tx) => {
      const bucket = await tx.systemWebhookRateLimitBucket.upsert({
        where: {
          subscriptionId_bucketStart: {
            subscriptionId: subscription.id,
            bucketStart,
          },
        },
        create: {
          subscriptionId: subscription.id,
          bucketStart,
          requestCount: 1,
          blockedCount: 0,
        },
        update: {
          requestCount: { increment: 1 },
        },
      });
      const allowed = bucket.requestCount <= limit;
      if (!allowed) {
        const blocked = await tx.systemWebhookRateLimitBucket.update({
          where: { id: bucket.id },
          data: { blockedCount: { increment: 1 } },
        });
        return {
          allowed: false,
          requestCount: blocked.requestCount,
          blockedCount: blocked.blockedCount,
        };
      }
      return {
        allowed: true,
        requestCount: bucket.requestCount,
        blockedCount: bucket.blockedCount,
      };
    });
  }
}
