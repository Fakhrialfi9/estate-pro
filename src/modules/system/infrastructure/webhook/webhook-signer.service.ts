import { createHash, createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookSignerService {
  buildPayload(input: {
    eventName: string;
    eventVersion: number;
    deliveryId: string;
    occurredAt: string;
    data: Record<string, unknown>;
  }): string {
    return JSON.stringify({
      id: input.deliveryId,
      type: input.eventName,
      version: input.eventVersion,
      occurredAt: input.occurredAt,
      data: input.data,
    });
  }

  signature(secret: string, timestamp: number, deliveryId: string, payload: string): string {
    const signed = `${timestamp}.${deliveryId}.${payload}`;
    return createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  }

  payloadHash(payload: string): string {
    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }
}
