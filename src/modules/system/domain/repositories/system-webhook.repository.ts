import type {
  SystemWebhookEventName,
  WebhookDeliveryRecord,
  WebhookDeliveryState,
  WebhookEventFilter,
  WebhookSubscriptionRecord,
  WebhookSubscriptionStatus,
} from '../webhook/webhook.contracts.js';

export const SYSTEM_WEBHOOK_REPOSITORY = Symbol('SYSTEM_WEBHOOK_REPOSITORY');

export interface SystemWebhookRepository {
  createSubscription(input: {
    uuid: string;
    endpoint: string;
    events: readonly SystemWebhookEventName[];
    filters: readonly WebhookEventFilter[];
    status: WebhookSubscriptionStatus;
    secretCiphertext: string;
    secretVersion: number;
    secretCreatedAt: Date;
  }): Promise<WebhookSubscriptionRecord>;
  findSubscription(uuid: string): Promise<WebhookSubscriptionRecord | null>;
  findSubscriptionByDelivery(
    deliveryUuid: string,
  ): Promise<WebhookSubscriptionRecord | null>;
  listSubscriptions(input: {
    page: number;
    limit: number;
    status?: WebhookSubscriptionStatus;
  }): Promise<{
    items: readonly WebhookSubscriptionRecord[];
    total: number;
  }>;
  updateSubscription(
    uuid: string,
    input: Partial<
      Pick<
        WebhookSubscriptionRecord,
        | 'endpoint'
        | 'events'
        | 'filters'
        | 'status'
        | 'secretCiphertext'
        | 'secretVersion'
        | 'secretCreatedAt'
      >
    >,
  ): Promise<WebhookSubscriptionRecord>;
  deleteSubscription(uuid: string): Promise<void>;
  createDelivery(input: {
    uuid: string;
    subscriptionId: bigint;
    eventId: string;
    eventName: SystemWebhookEventName;
    eventVersion: number;
    payloadHash: string;
    state: WebhookDeliveryState;
    signedAt: Date;
    nextAttemptAt?: Date | null;
  }): Promise<{ created: boolean; record: WebhookDeliveryRecord }>;
  findDelivery(uuid: string): Promise<WebhookDeliveryRecord | null>;
  updateDelivery(
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
  ): Promise<WebhookDeliveryRecord>;
  listDeliveries(input: {
    subscriptionUuid?: string;
    state?: WebhookDeliveryState;
    page: number;
    limit: number;
  }): Promise<{ items: readonly WebhookDeliveryRecord[]; total: number }>;
  listExpiredDeliveries(
    before: Date,
    limit: number,
  ): Promise<readonly WebhookDeliveryRecord[]>;
  deleteDeliveries(uuids: readonly string[]): Promise<void>;
}
