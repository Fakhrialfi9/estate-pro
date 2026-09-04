import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type {
  SystemWebhookEventName,
  WebhookDeliveryRecord,
  WebhookDeliveryState,
  WebhookSubscriptionRecord,
} from '../../domain/webhook/webhook.contracts.js';
import { SYSTEM_WEBHOOK_EVENTS } from '../../domain/webhook/webhook.contracts.js';
import type {
  SystemWebhookNetworkPort,
  SystemWebhookSecretPort,
  SystemWebhookSignerPort,
} from '../../domain/webhook/webhook.ports.js';
import {
  SYSTEM_WEBHOOK_NETWORK_PORT,
  SYSTEM_WEBHOOK_SECRET_PORT,
  SYSTEM_WEBHOOK_SIGNER_PORT,
} from '../../domain/webhook/webhook.ports.js';
import {
  SYSTEM_WEBHOOK_REPOSITORY,
  type SystemWebhookRepository,
} from '../../domain/repositories/system-webhook.repository.js';

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_BASE_MS = 1_000;
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const AUDIT_ACTION = 'SYSTEM_SETTING_UPDATED';

@Injectable()
export class SystemWebhookService {
  constructor(
    @Inject(SYSTEM_WEBHOOK_REPOSITORY)
    private readonly repository: SystemWebhookRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    @Inject(SYSTEM_WEBHOOK_SECRET_PORT)
    private readonly secrets: SystemWebhookSecretPort,
    @Inject(SYSTEM_WEBHOOK_SIGNER_PORT)
    private readonly signer: SystemWebhookSignerPort,
    @Inject(SYSTEM_WEBHOOK_NETWORK_PORT)
    private readonly network: SystemWebhookNetworkPort,
  ) {}

  eventCatalog() {
    return SYSTEM_WEBHOOK_EVENTS.map((name) => ({ name, version: 1 }));
  }

  async create(actorUuid: string, endpoint: string, events: readonly SystemWebhookEventName[]) {
    const safeEndpoint = await this.network.validateTarget(endpoint);
    const normalizedEvents = this.normalizeEvents(events);
    const generated = this.secrets.generate();
    const row = await this.repository.createSubscription({
      uuid: randomUUID(), endpoint: safeEndpoint.toString(), events: normalizedEvents,
      status: 'ACTIVE', secretCiphertext: generated.ciphertext, secretVersion: 1, secretCreatedAt: new Date(),
    });
    await this.auditLifecycle(actorUuid, row.uuid, 'webhook.created');
    return { ...this.toPublic(row), secret: generated.secret };
  }

  async list(page = 1, limit = 20, status?: 'ACTIVE' | 'DISABLED') {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const result = await this.repository.listSubscriptions({ page: normalizedPage, limit: normalizedLimit, status });
    return { items: result.items.map((row) => this.toPublic(row)), total: result.total, page: normalizedPage, limit: normalizedLimit };
  }

  async get(uuid: string) {
    const row = await this.repository.findSubscription(uuid);
    if (!row) throw new NotFoundException('Webhook subscription not found');
    return this.toPublic(row);
  }

  async update(actorUuid: string, uuid: string, input: { endpoint?: string; events?: readonly SystemWebhookEventName[]; enabled?: boolean }) {
    const existing = await this.repository.findSubscription(uuid);
    if (!existing) throw new NotFoundException('Webhook subscription not found');
    const endpoint = input.endpoint ? (await this.network.validateTarget(input.endpoint)).toString() : undefined;
    const events = input.events ? this.normalizeEvents(input.events) : undefined;
    const row = await this.repository.updateSubscription(uuid, {
      ...(endpoint ? { endpoint } : {}),
      ...(events ? { events } : {}),
      ...(typeof input.enabled === 'boolean' ? { status: input.enabled ? 'ACTIVE' : 'DISABLED' } : {}),
    });
    await this.auditLifecycle(actorUuid, uuid, 'webhook.updated');
    return this.toPublic(row);
  }

  async remove(actorUuid: string, uuid: string): Promise<void> {
    await this.get(uuid);
    await this.repository.deleteSubscription(uuid);
    await this.auditLifecycle(actorUuid, uuid, 'webhook.deleted');
  }

  async rotateSecret(actorUuid: string, uuid: string) {
    const existing = await this.repository.findSubscription(uuid);
    if (!existing) throw new NotFoundException('Webhook subscription not found');
    const generated = this.secrets.generate();
    const row = await this.repository.updateSubscription(uuid, { secretCiphertext: generated.ciphertext, secretVersion: existing.secretVersion + 1, secretCreatedAt: new Date() });
    await this.auditLifecycle(actorUuid, uuid, `webhook.secret_rotated.version=${row.secretVersion}`);
    return { uuid: row.uuid, secretVersion: row.secretVersion, secret: generated.secret };
  }

  async publish(eventName: SystemWebhookEventName, data: Record<string, unknown>) {
    if (!SYSTEM_WEBHOOK_EVENTS.includes(eventName)) throw new ForbiddenException('Unsupported webhook event');
    const subscriptions = await this.repository.listSubscriptions({ page: 1, limit: 100, status: 'ACTIVE' });
    for (const subscription of subscriptions.items) {
      if (subscription.events.includes(eventName)) await this.deliver(subscription, eventName, 1, data);
    }
  }

  async test(actorUuid: string, uuid: string) {
    const row = await this.repository.findSubscription(uuid);
    if (!row) throw new NotFoundException('Webhook subscription not found');
    const delivery = await this.deliver(row, 'system.activity.created', 1, { test: true });
    await this.auditLifecycle(actorUuid, uuid, 'webhook.tested');
    return this.toDelivery(delivery);
  }

  async listDeliveries(uuid: string, page = 1, limit = 20, state?: WebhookDeliveryState) {
    await this.get(uuid);
    const result = await this.repository.listDeliveries({ subscriptionUuid: uuid, page: Math.max(1, page), limit: Math.min(100, Math.max(1, limit)), state });
    return { ...result, items: result.items.map((item) => this.toDelivery(item)) };
  }

  async replay(actorUuid: string, deliveryUuid: string) {
    const existing = await this.repository.findDelivery(deliveryUuid);
    if (!existing) throw new NotFoundException('Webhook delivery not found');
    const subscription = await this.repository.findSubscriptionByDelivery(deliveryUuid);
    if (!subscription) throw new NotFoundException('Webhook subscription not found');
    if (subscription.status !== 'ACTIVE') throw new ForbiddenException('Webhook subscription is disabled');
    const delivery = await this.deliver(subscription, existing.eventName, existing.eventVersion, { replayOf: existing.uuid });
    await this.auditLifecycle(actorUuid, subscription.uuid, `webhook.replayed.delivery=${delivery.uuid}`);
    return this.toDelivery(delivery);
  }

  async cleanup(retentionDays = 30, limit = 500) {
    const boundedDays = Math.min(3650, Math.max(1, retentionDays));
    const before = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000);
    const rows = await this.repository.listExpiredDeliveries(before, Math.min(500, Math.max(1, limit)));
    await this.repository.deleteDeliveries(rows.map((row) => row.uuid));
    return { scanned: rows.length, deleted: rows.length };
  }

  private async deliver(subscription: WebhookSubscriptionRecord, eventName: SystemWebhookEventName, eventVersion: number, data: Record<string, unknown>): Promise<WebhookDeliveryRecord> {
    const deliveryId = randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = this.signer.buildPayload({ eventName, eventVersion, deliveryId, occurredAt: new Date(timestamp * 1000).toISOString(), data });
    if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) throw new ForbiddenException('Webhook payload exceeds the configured limit');
    const payloadHash = this.signer.payloadHash(payload);
    await this.repository.createDelivery({ uuid: deliveryId, subscriptionId: subscription.id, eventName, eventVersion, payloadHash, state: 'PENDING', signedAt: new Date(timestamp * 1000) });
    const secret = this.secrets.decrypt(subscription.secretCiphertext);
    const signature = this.signer.signature(secret, timestamp, deliveryId, payload);
    let lastFailure = 'Webhook delivery failed';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await this.repository.updateDelivery(deliveryId, { state: 'DELIVERING', attemptCount: attempt });
      try {
        const response = await this.network.send({
          endpoint: subscription.endpoint,
          payload,
          timeoutMs: REQUEST_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'EstatePro-Webhooks/1', 'X-Webhook-Id': deliveryId, 'X-Webhook-Timestamp': String(timestamp), 'X-Webhook-Signature': `v1=${signature}`, 'X-Webhook-Event': eventName, 'X-Webhook-Version': String(eventVersion) },
        });
        if (response.status >= 200 && response.status < 300) return this.repository.updateDelivery(deliveryId, { state: 'SUCCEEDED', httpStatus: response.status, completedAt: new Date(), responseSummary: `HTTP ${response.status}`, nextAttemptAt: null, failureReason: null });
        if (response.status >= 300 && response.status < 400) { lastFailure = 'Redirects are not allowed for webhook delivery'; break; }
        lastFailure = `HTTP ${response.status}`;
      } catch (error: unknown) {
        lastFailure = error instanceof Error && error.name === 'AbortError' ? 'Webhook request timed out' : 'Webhook request failed';
      }
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250), 30_000);
        await this.repository.updateDelivery(deliveryId, { state: 'RETRYING', nextAttemptAt: new Date(Date.now() + delay), failureReason: lastFailure });
      }
    }
    return this.repository.updateDelivery(deliveryId, { state: 'DEAD_LETTER', completedAt: new Date(), nextAttemptAt: null, failureReason: lastFailure, responseSummary: 'delivery failed after bounded retries' });
  }

  private normalizeEvents(events: readonly SystemWebhookEventName[]) {
    const unique = [...new Set(events)];
    if (unique.length === 0) throw new ForbiddenException('At least one webhook event is required');
    if (unique.some((event) => !SYSTEM_WEBHOOK_EVENTS.includes(event))) throw new ForbiddenException('Unsupported webhook event');
    return unique;
  }

  private async auditLifecycle(actorUuid: string, uuid: string, reason: string) {
    await this.audit.record({ action: AUDIT_ACTION, actorUuid, subjectUuid: actorUuid, entityType: 'system_setting', entityUuid: uuid, result: 'SUCCESS', reason });
  }

  private toPublic(row: WebhookSubscriptionRecord) {
    return { uuid: row.uuid, endpoint: row.endpoint, status: row.status, events: row.events, secretVersion: row.secretVersion, secretCreatedAt: row.secretCreatedAt, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }

  private toDelivery(row: WebhookDeliveryRecord) {
    return { uuid: row.uuid, eventName: row.eventName, eventVersion: row.eventVersion, payloadHash: row.payloadHash, attemptCount: row.attemptCount, state: row.state, httpStatus: row.httpStatus, responseSummary: row.responseSummary, nextAttemptAt: row.nextAttemptAt, signedAt: row.signedAt, completedAt: row.completedAt, failureReason: row.failureReason, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }
}
