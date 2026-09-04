import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import type {
  SystemWebhookEventName,
  WebhookDeliveryRecord,
  WebhookDeliveryState,
  WebhookSubscriptionRecord,
  WebhookSubscriptionStatus,
} from '../../domain/webhook/webhook.contracts.js';
import type { SystemWebhookRepository } from '../../domain/repositories/system-webhook.repository.js';

const eventList = (value: unknown): readonly SystemWebhookEventName[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is SystemWebhookEventName => typeof item === 'string',
      )
    : [];

const toSubscription = (row: {
  id: bigint;
  uuid: string;
  endpoint: string;
  status: string;
  events: unknown;
  secretCiphertext: string;
  secretVersion: number;
  secretCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): WebhookSubscriptionRecord => ({
  ...row,
  status: row.status as WebhookSubscriptionStatus,
  events: eventList(row.events),
});

const toDelivery = (row: {
  id: bigint;
  uuid: string;
  subscriptionId: bigint;
  eventId: string;
  eventName: string;
  eventVersion: number;
  payloadHash: string;
  attemptCount: number;
  state: string;
  httpStatus: number | null;
  responseSummary: string | null;
  nextAttemptAt: Date | null;
  signedAt: Date;
  completedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WebhookDeliveryRecord => ({
  ...row,
  eventName: row.eventName as SystemWebhookEventName,
  state: row.state as WebhookDeliveryState,
});

@Injectable()
export class PrismaSystemWebhookRepository implements SystemWebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSubscription(input: {
    uuid: string;
    endpoint: string;
    events: readonly SystemWebhookEventName[];
    status: WebhookSubscriptionStatus;
    secretCiphertext: string;
    secretVersion: number;
    secretCreatedAt: Date;
  }): Promise<WebhookSubscriptionRecord> {
    const row = await this.prisma.systemWebhookSubscription.create({
      data: { ...input, events: [...input.events] },
    });
    return toSubscription(row);
  }

  async findSubscription(
    uuid: string,
  ): Promise<WebhookSubscriptionRecord | null> {
    const row = await this.prisma.systemWebhookSubscription.findUnique({
      where: { uuid },
    });
    return row ? toSubscription(row) : null;
  }

  async findSubscriptionByDelivery(
    deliveryUuid: string,
  ): Promise<WebhookSubscriptionRecord | null> {
    const row = await this.prisma.systemWebhookDelivery.findUnique({
      where: { uuid: deliveryUuid },
      include: { subscription: true },
    });
    return row ? toSubscription(row.subscription) : null;
  }

  async listSubscriptions(input: {
    page: number;
    limit: number;
    status?: WebhookSubscriptionStatus;
  }) {
    const where = input.status ? { status: input.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.systemWebhookSubscription.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.systemWebhookSubscription.count({ where }),
    ]);
    return { items: items.map(toSubscription), total };
  }

  async updateSubscription(
    uuid: string,
    input: Partial<
      Pick<
        WebhookSubscriptionRecord,
        | 'endpoint'
        | 'events'
        | 'status'
        | 'secretCiphertext'
        | 'secretVersion'
        | 'secretCreatedAt'
      >
    >,
  ) {
    try {
      const row = await this.prisma.systemWebhookSubscription.update({
        where: { uuid },
        data: {
          ...input,
          ...(input.events ? { events: [...input.events] } : {}),
        },
      });
      return toSubscription(row);
    } catch {
      throw new NotFoundException('Webhook subscription not found');
    }
  }

  async deleteSubscription(uuid: string): Promise<void> {
    try {
      await this.prisma.systemWebhookSubscription.delete({ where: { uuid } });
    } catch {
      throw new NotFoundException('Webhook subscription not found');
    }
  }

  async createDelivery(input: {
    uuid: string;
    subscriptionId: bigint;
    eventId: string;
    eventName: SystemWebhookEventName;
    eventVersion: number;
    payloadHash: string;
    state: WebhookDeliveryState;
    signedAt: Date;
    nextAttemptAt?: Date | null;
  }): Promise<{ created: boolean; record: WebhookDeliveryRecord }> {
    try {
      const row = await this.prisma.systemWebhookDelivery.create({
        data: input,
      });
      return { created: true, record: toDelivery(row) };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.systemWebhookDelivery.findFirst({
          where: {
            subscriptionId: input.subscriptionId,
            eventId: input.eventId,
          },
        });
        if (existing) return { created: false, record: toDelivery(existing) };
      }
      throw error;
    }
  }

  async findDelivery(uuid: string): Promise<WebhookDeliveryRecord | null> {
    const row = await this.prisma.systemWebhookDelivery.findUnique({
      where: { uuid },
    });
    return row ? toDelivery(row) : null;
  }

  async updateDelivery(
    uuid: string,
    input: Partial<
      Pick<
        WebhookDeliveryRecord,
        | 'attemptCount'
        | 'state'
        | 'httpStatus'
        | 'responseSummary'
        | 'nextAttemptAt'
        | 'completedAt'
        | 'failureReason'
      >
    >,
  ) {
    const row = await this.prisma.systemWebhookDelivery.update({
      where: { uuid },
      data: input,
    });
    return toDelivery(row);
  }

  async listDeliveries(input: {
    subscriptionUuid?: string;
    state?: WebhookDeliveryState;
    page: number;
    limit: number;
  }) {
    const where = {
      ...(input.state ? { state: input.state } : {}),
      ...(input.subscriptionUuid
        ? { subscription: { uuid: input.subscriptionUuid } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.systemWebhookDelivery.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.systemWebhookDelivery.count({ where }),
    ]);
    return { items: items.map(toDelivery), total };
  }

  async listExpiredDeliveries(before: Date, limit: number) {
    const rows = await this.prisma.systemWebhookDelivery.findMany({
      where: {
        createdAt: { lte: before },
        state: { in: ['SUCCEEDED', 'DEAD_LETTER', 'CANCELLED'] },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map(toDelivery);
  }

  async deleteDeliveries(uuids: readonly string[]): Promise<void> {
    if (uuids.length === 0) return;
    await this.prisma.systemWebhookDelivery.deleteMany({
      where: { uuid: { in: [...uuids] } },
    });
  }
}
