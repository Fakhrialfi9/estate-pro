import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { AuditAction } from '../../../../common/audit/audit-events.js';
import type {
  SystemWebhookEventName,
  WebhookDeliveryRecord,
  WebhookDeliveryState,
  WebhookEventFilter,
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

const FILTER_MAX_COUNT = 10;
const FILTER_MAX_DEPTH = 5;
const FILTER_KEY = /^[A-Za-z0-9_]+$/;

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
    private readonly config: ConfigService,
  ) {}

  eventCatalog() {
    return SYSTEM_WEBHOOK_EVENTS.map((name) => ({ name, version: 1 }));
  }

  async create(
    actorUuid: string,
    endpoint: string,
    events: readonly SystemWebhookEventName[],
    filters: readonly WebhookEventFilter[] = [],
  ) {
    const safeEndpoint = await this.network.validateTarget(endpoint);
    const normalizedEvents = this.normalizeEvents(events);
    const normalizedFilters = this.normalizeFilters(filters);
    const generated = this.secrets.generate();
    const row = await this.repository.createSubscription({
      uuid: randomUUID(),
      endpoint: safeEndpoint.toString(),
      events: normalizedEvents,
      filters: normalizedFilters,
      status: 'ACTIVE',
      secretCiphertext: generated.ciphertext,
      secretVersion: 1,
      secretCreatedAt: new Date(),
    });
    await this.auditLifecycle(actorUuid, row.uuid, 'SYSTEM_WEBHOOK_CREATED');
    return { ...this.toPublic(row), secret: generated.secret };
  }

  async list(page = 1, limit = 20, status?: 'ACTIVE' | 'DISABLED') {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const result = await this.repository.listSubscriptions({
      page: normalizedPage,
      limit: normalizedLimit,
      status,
    });
    return {
      items: result.items.map((row) => this.toPublic(row)),
      total: result.total,
      page: normalizedPage,
      limit: normalizedLimit,
    };
  }

  async get(uuid: string) {
    const row = await this.repository.findSubscription(uuid);
    if (!row) throw new NotFoundException('Webhook subscription not found');
    return this.toPublic(row);
  }

  async update(
    actorUuid: string,
    uuid: string,
    input: {
      endpoint?: string;
      events?: readonly SystemWebhookEventName[];
      filters?: readonly WebhookEventFilter[];
      enabled?: boolean;
    },
  ) {
    const existing = await this.repository.findSubscription(uuid);
    if (!existing)
      throw new NotFoundException('Webhook subscription not found');
    const endpoint = input.endpoint
      ? (await this.network.validateTarget(input.endpoint)).toString()
      : undefined;
    const events = input.events
      ? this.normalizeEvents(input.events)
      : undefined;
    const filters = input.filters
      ? this.normalizeFilters(input.filters)
      : undefined;
    const row = await this.repository.updateSubscription(uuid, {
      ...(endpoint ? { endpoint } : {}),
      ...(events ? { events } : {}),
      ...(filters ? { filters } : {}),
      ...(typeof input.enabled === 'boolean'
        ? { status: input.enabled ? 'ACTIVE' : 'DISABLED' }
        : {}),
    });
    await this.auditLifecycle(actorUuid, uuid, 'SYSTEM_WEBHOOK_UPDATED');
    return this.toPublic(row);
  }

  async remove(actorUuid: string, uuid: string): Promise<void> {
    await this.get(uuid);
    await this.repository.deleteSubscription(uuid);
    await this.auditLifecycle(actorUuid, uuid, 'SYSTEM_WEBHOOK_DELETED');
  }

  async rotateSecret(actorUuid: string, uuid: string) {
    const existing = await this.repository.findSubscription(uuid);
    if (!existing)
      throw new NotFoundException('Webhook subscription not found');
    const generated = this.secrets.generate();
    const row = await this.repository.updateSubscription(uuid, {
      secretCiphertext: generated.ciphertext,
      secretVersion: existing.secretVersion + 1,
      secretCreatedAt: new Date(),
    });
    await this.auditLifecycle(
      actorUuid,
      uuid,
      'SYSTEM_WEBHOOK_SECRET_ROTATED',
      `version=${row.secretVersion}`,
    );
    return {
      uuid: row.uuid,
      secretVersion: row.secretVersion,
      secret: generated.secret,
    };
  }

  async publish(
    eventId: string,
    eventName: SystemWebhookEventName,
    data: Record<string, unknown>,
  ) {
    if (!eventId.trim())
      throw new ForbiddenException('Webhook event ID is required');
    if (!SYSTEM_WEBHOOK_EVENTS.includes(eventName))
      throw new ForbiddenException('Unsupported webhook event');
    const subscriptions = await this.repository.listSubscriptions({
      page: 1,
      limit: 100,
      status: 'ACTIVE',
    });
    for (const subscription of subscriptions.items) {
      if (
        subscription.events.includes(eventName) &&
        this.matchesFilters(subscription.filters, data)
      ) {
        await this.deliver(
          subscription,
          eventId,
          eventName,
          1,
          data,
          eventId,
        );
      }
    }
  }

  async test(actorUuid: string, uuid: string) {
    const row = await this.repository.findSubscription(uuid);
    if (!row) throw new NotFoundException('Webhook subscription not found');
    const delivery = await this.deliver(
      row,
      `test:${randomUUID()}`,
      'system.activity.created',
      1,
      { test: true },
      `test:${randomUUID()}`,
    );
    await this.auditLifecycle(actorUuid, uuid, 'SYSTEM_WEBHOOK_TESTED');
    return this.toDelivery(delivery);
  }

  async listDeliveries(
    uuid: string,
    page = 1,
    limit = 20,
    state?: WebhookDeliveryState,
  ) {
    await this.get(uuid);
    const result = await this.repository.listDeliveries({
      subscriptionUuid: uuid,
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      state,
    });
    return {
      ...result,
      items: result.items.map((item) => this.toDelivery(item)),
    };
  }

  async replay(actorUuid: string, deliveryUuid: string) {
    const existing = await this.repository.findDelivery(deliveryUuid);
    if (!existing) throw new NotFoundException('Webhook delivery not found');
    const subscription =
      await this.repository.findSubscriptionByDelivery(deliveryUuid);
    if (!subscription)
      throw new NotFoundException('Webhook subscription not found');
    if (subscription.status !== 'ACTIVE')
      throw new ForbiddenException('Webhook subscription is disabled');
    const deliveryKey = `replay:${randomUUID()}`;
    const delivery = await this.deliver(
      subscription,
      existing.eventId,
      existing.eventName,
      existing.eventVersion,
      { replayOf: existing.uuid },
      deliveryKey,
    );
    await this.auditLifecycle(
      actorUuid,
      subscription.uuid,
      'SYSTEM_WEBHOOK_REPLAYED',
      `delivery=${delivery.uuid};event=${existing.eventId}`,
    );
    return this.toDelivery(delivery);
  }

  async cleanup(retentionDays?: number, limit = 500) {
    const configured = this.config.get<number>(
      'system.webhook.retentionDays',
      30,
    );
    const boundedDays = Math.min(
      3650,
      Math.max(1, retentionDays ?? configured),
    );
    const before = new Date(
      Date.now() - boundedDays * 24 * 60 * 60 * 1000,
    );
    const rows = await this.repository.listExpiredDeliveries(
      before,
      Math.min(500, Math.max(1, limit)),
    );
    await this.repository.deleteDeliveries(rows.map((row) => row.uuid));
    return { scanned: rows.length, deleted: rows.length };
  }

  private async deliver(
    subscription: WebhookSubscriptionRecord,
    eventId: string,
    eventName: SystemWebhookEventName,
    eventVersion: number,
    data: Record<string, unknown>,
    deliveryKey: string,
  ): Promise<WebhookDeliveryRecord> {
    const deliveryId = randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = this.signer.buildPayload({
      eventId,
      eventName,
      eventVersion,
      deliveryId,
      occurredAt: new Date(timestamp * 1000).toISOString(),
      data,
    });
    const maxPayloadBytes = this.config.get<number>(
      'system.webhook.maxPayloadBytes',
      1024 * 1024,
    );
    if (Buffer.byteLength(payload, 'utf8') > maxPayloadBytes)
      throw new ForbiddenException(
        'Webhook payload exceeds the configured limit',
      );

    const payloadHash = this.signer.payloadHash(payload);
    const created = await this.repository.createDelivery({
      uuid: deliveryId,
      subscriptionId: subscription.id,
      eventId,
      deliveryKey,
      eventName,
      eventVersion,
      payloadHash,
      state: 'PENDING',
      signedAt: new Date(timestamp * 1000),
    });
    if (!created.created) return created.record;

    const secret = this.secrets.decrypt(subscription.secretCiphertext);
    const signature = this.signer.signature(
      secret,
      timestamp,
      deliveryId,
      payload,
    );
    const maxAttempts = this.config.get<number>(
      'system.webhook.maxAttempts',
      5,
    );
    const timeoutMs = this.config.get<number>(
      'system.webhook.timeoutMs',
      5000,
    );
    let lastFailure = 'Webhook delivery failed';
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.repository.updateDelivery(deliveryId, {
        state: 'DELIVERING',
        attemptCount: attempt,
      });
      try {
        const response = await this.network.send({
          endpoint: subscription.endpoint,
          payload,
          timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'EstatePro-Webhooks/1',
            'X-Webhook-Id': deliveryId,
            'X-Webhook-Event-Id': eventId,
            'X-Webhook-Timestamp': String(timestamp),
            'X-Webhook-Signature': `v1=${signature}`,
            'X-Webhook-Event': eventName,
            'X-Webhook-Version': String(eventVersion),
          },
        });
        if (response.status >= 200 && response.status < 300)
          return this.repository.updateDelivery(deliveryId, {
            state: 'SUCCEEDED',
            httpStatus: response.status,
            completedAt: new Date(),
            responseSummary: `HTTP ${response.status}`,
            nextAttemptAt: null,
            failureReason: null,
          });
        if (response.status >= 300 && response.status < 400) {
          lastFailure = 'Redirects are not allowed for webhook delivery';
          break;
        }
        lastFailure = `HTTP ${response.status}`;
      } catch (error: unknown) {
        lastFailure =
          error instanceof Error && error.name === 'AbortError'
            ? 'Webhook request timed out'
            : 'Webhook request failed';
      }
      if (attempt < maxAttempts) {
        const delay = Math.min(
          1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250),
          30_000,
        );
        await this.repository.updateDelivery(deliveryId, {
          state: 'RETRYING',
          nextAttemptAt: new Date(Date.now() + delay),
          failureReason: lastFailure,
        });
      }
    }
    return this.repository.updateDelivery(deliveryId, {
      state: 'DEAD_LETTER',
      completedAt: new Date(),
      nextAttemptAt: null,
      failureReason: lastFailure,
      responseSummary: 'delivery failed after bounded retries',
    });
  }

  private normalizeEvents(events: readonly SystemWebhookEventName[]) {
    const unique = [...new Set(events)];
    if (unique.length === 0)
      throw new ForbiddenException('At least one webhook event is required');
    if (unique.some((event) => !SYSTEM_WEBHOOK_EVENTS.includes(event)))
      throw new ForbiddenException('Unsupported webhook event');
    return unique;
  }

  private normalizeFilters(
    filters: readonly WebhookEventFilter[],
  ): readonly WebhookEventFilter[] {
    if (filters.length > FILTER_MAX_COUNT)
      throw new ForbiddenException('Too many webhook filters');
    return filters.map((filter) => {
      const field = filter.field.trim();
      const path = field.split('.');
      if (
        path.length === 0 ||
        path.length > FILTER_MAX_DEPTH ||
        path.some(
          (key) =>
            !FILTER_KEY.test(key) ||
            /^(?:__proto__|prototype|constructor)$/i.test(key),
        )
      ) {
        throw new ForbiddenException('Invalid webhook filter field');
      }
      if (filter.operator === 'IN') {
        if (!Array.isArray(filter.value) || filter.value.length > 50)
          throw new ForbiddenException(
            'Webhook IN filter requires a bounded array',
          );
      }
      if (['GT', 'GTE', 'LT', 'LTE'].includes(filter.operator)) {
        const type = typeof filter.value;
        if (type !== 'number' && type !== 'string')
          throw new ForbiddenException(
            'Webhook comparison filters require a scalar value',
          );
      }
      if (['EXISTS', 'NOT_EXISTS'].includes(filter.operator))
        return { field, operator: filter.operator };
      return { field, operator: filter.operator, value: filter.value };
    });
  }

  private matchesFilters(
    filters: readonly WebhookEventFilter[],
    data: Record<string, unknown>,
  ): boolean {
    for (const filter of filters) {
      const actual = this.readFilterValue(data, filter.field);
      const exists = actual !== undefined;
      switch (filter.operator) {
        case 'EXISTS':
          if (!exists) return false;
          break;
        case 'NOT_EXISTS':
          if (exists) return false;
          break;
        case 'EQ':
          if (actual !== filter.value) return false;
          break;
        case 'NEQ':
          if (actual === filter.value) return false;
          break;
        case 'CONTAINS':
          if (
            typeof actual !== 'string' ||
            !actual.includes(String(filter.value))
          )
            return false;
          break;
        case 'IN':
          if (
            !Array.isArray(filter.value) ||
            !filter.value.some((value) => value === actual)
          )
            return false;
          break;
        case 'GT':
          if (!this.compare(actual, filter.value, (a, b) => a > b)) return false;
          break;
        case 'GTE':
          if (!this.compare(actual, filter.value, (a, b) => a >= b)) return false;
          break;
        case 'LT':
          if (!this.compare(actual, filter.value, (a, b) => a < b)) return false;
          break;
        case 'LTE':
          if (!this.compare(actual, filter.value, (a, b) => a <= b)) return false;
          break;
      }
    }
    return true;
  }

  private readFilterValue(data: Record<string, unknown>, field: string): unknown {
    return field.split('.').reduce<unknown>((current, key) => {
      if (
        current === null ||
        typeof current !== 'object' ||
        Array.isArray(current)
      )
        return undefined;
      const value = current as Record<string, unknown>;
      return Object.prototype.hasOwnProperty.call(value, key)
        ? value[key]
        : undefined;
    }, data);
  }

  private compare(
    actual: unknown,
    expected: unknown,
    predicate: (left: string | number, right: string | number) => boolean,
  ): boolean {
    if (
      (typeof actual !== 'number' && typeof actual !== 'string') ||
      (typeof expected !== 'number' && typeof expected !== 'string') ||
      typeof actual !== typeof expected
    )
      return false;
    return predicate(actual, expected);
  }

  private async auditLifecycle(
    actorUuid: string,
    uuid: string,
    action: AuditAction,
    reason?: string,
  ) {
    await this.audit.record({
      action,
      actorUuid,
      subjectUuid: actorUuid,
      entityType: 'system_webhook',
      entityUuid: uuid,
      result: 'SUCCESS',
      ...(reason ? { reason } : {}),
    });
  }

  private toPublic(row: WebhookSubscriptionRecord) {
    return {
      uuid: row.uuid,
      endpoint: row.endpoint,
      status: row.status,
      events: row.events,
      filters: row.filters,
      secretVersion: row.secretVersion,
      secretCreatedAt: row.secretCreatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toDelivery(row: WebhookDeliveryRecord) {
    return {
      uuid: row.uuid,
      eventId: row.eventId,
      deliveryKey: row.deliveryKey,
      eventName: row.eventName,
      eventVersion: row.eventVersion,
      payloadHash: row.payloadHash,
      attemptCount: row.attemptCount,
      state: row.state,
      httpStatus: row.httpStatus,
      responseSummary: row.responseSummary,
      nextAttemptAt: row.nextAttemptAt,
      signedAt: row.signedAt,
      completedAt: row.completedAt,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
