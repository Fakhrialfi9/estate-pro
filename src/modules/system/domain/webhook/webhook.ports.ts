import type { SystemWebhookEventName } from './webhook.contracts.js';

export const SYSTEM_WEBHOOK_SECRET_PORT = Symbol('SYSTEM_WEBHOOK_SECRET_PORT');
export const SYSTEM_WEBHOOK_SIGNER_PORT = Symbol('SYSTEM_WEBHOOK_SIGNER_PORT');
export const SYSTEM_WEBHOOK_NETWORK_PORT = Symbol('SYSTEM_WEBHOOK_NETWORK_PORT');

export interface SystemWebhookSecretPort {
  generate(): { secret: string; ciphertext: string };
  decrypt(ciphertext: string): string;
}

export interface SystemWebhookSignerPort {
  buildPayload(input: {
    eventName: SystemWebhookEventName;
    eventVersion: number;
    deliveryId: string;
    occurredAt: string;
    data: Record<string, unknown>;
  }): string;
  signature(
    secret: string,
    timestamp: number,
    deliveryId: string,
    payload: string,
  ): string;
  payloadHash(payload: string): string;
}

export interface SystemWebhookNetworkPort {
  validateTarget(rawUrl: string): Promise<URL>;
  send(input: {
    endpoint: string;
    payload: string;
    headers: Readonly<Record<string, string>>;
    timeoutMs: number;
  }): Promise<{ status: number }>;
}
