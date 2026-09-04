import { createHash, createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SystemWebhookSignerPort } from '../../domain/webhook/webhook.ports.js';
import type { SystemWebhookEventName } from '../../domain/webhook/webhook.contracts.js';

@Injectable()
export class WebhookSignerService implements SystemWebhookSignerPort {
  buildPayload(input: {
    eventId: string;
    eventName: SystemWebhookEventName;
    eventVersion: number;
    deliveryId: string;
    occurredAt: string;
    data: Record<string, unknown>;
  }): string {
    return JSON.stringify({
      id: input.eventId,
      deliveryId: input.deliveryId,
      type: input.eventName,
      version: input.eventVersion,
      occurredAt: input.occurredAt,
      data: input.data,
    });
  }

  signature(
    secret: string,
    timestamp: number,
    deliveryId: string,
    payload: string,
  ): string {
    return createHmac('sha256', secret)
      .update(`${timestamp}.${deliveryId}.${payload}`, 'utf8')
      .digest('hex');
  }

  payloadHash(payload: string): string {
    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }
}
