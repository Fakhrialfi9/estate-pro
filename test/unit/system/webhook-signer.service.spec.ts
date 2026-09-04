import { describe, expect, it } from 'vitest';
import { WebhookSignerService } from '../../../src/modules/system/infrastructure/webhook/webhook-signer.service.js';

describe('WebhookSignerService', () => {
  it('builds deterministic versioned payloads including stable event identity', () => {
    const service = new WebhookSignerService();
    const payload = service.buildPayload({
      eventId: 'event-1',
      eventName: 'system.activity.created',
      eventVersion: 1,
      deliveryId: 'delivery-1',
      occurredAt: '2026-09-05T00:00:00.000Z',
      data: { value: 'safe' },
    });
    expect(payload).toContain('"id":"event-1"');
    expect(payload).toContain('system.activity.created');
    expect(service.signature('secret', 10, 'delivery-1', payload)).toBe(
      service.signature('secret', 10, 'delivery-1', payload),
    );
    expect(service.signature('secret', 10, 'delivery-1', payload)).not.toBe(
      service.signature('other-secret', 10, 'delivery-1', payload),
    );
  });
});
