export const SYSTEM_WEBHOOK_EVENTS = [
  'system.activity.created',
  'system.import.completed',
  'system.export.completed',
] as const;

export type SystemWebhookEventName = (typeof SYSTEM_WEBHOOK_EVENTS)[number];
export type WebhookSubscriptionStatus = 'ACTIVE' | 'DISABLED';
export type WebhookDeliveryState =
  | 'PENDING'
  | 'DELIVERING'
  | 'SUCCEEDED'
  | 'RETRYING'
  | 'DEAD_LETTER'
  | 'CANCELLED';
export type WebhookFilterOperator =
  | 'EQ'
  | 'NEQ'
  | 'CONTAINS'
  | 'IN'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'EXISTS'
  | 'NOT_EXISTS';

export interface WebhookEventFilter {
  readonly field: string;
  readonly operator: WebhookFilterOperator;
  readonly value?: unknown;
}

export interface WebhookSubscriptionRecord {
  id: bigint;
  uuid: string;
  endpoint: string;
  status: WebhookSubscriptionStatus;
  events: readonly SystemWebhookEventName[];
  filters: readonly WebhookEventFilter[];
  secretCiphertext: string;
  secretVersion: number;
  secretCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryRecord {
  id: bigint;
  uuid: string;
  subscriptionId: bigint;
  eventId: string;
  deliveryKey: string;
  eventName: SystemWebhookEventName;
  eventVersion: number;
  payloadHash: string;
  attemptCount: number;
  state: WebhookDeliveryState;
  httpStatus: number | null;
  responseSummary: string | null;
  nextAttemptAt: Date | null;
  signedAt: Date;
  completedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryRequest {
  readonly subscription: WebhookSubscriptionRecord;
  readonly eventId: string;
  readonly eventName: SystemWebhookEventName;
  readonly eventVersion: number;
  readonly payload: Record<string, unknown>;
  readonly deliveryId: string;
}
