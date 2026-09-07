import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { IntegrationProviderPort } from '../../domain/integration/integration.contracts.js';
import {
  SYSTEM_INTEGRATION_REPOSITORY,
  type SystemIntegrationRepository,
} from '../../domain/repositories/system-integration.repository.js';
import {
  SYSTEM_ROADMAP_REPOSITORY,
  type SystemRoadmapRepository,
} from '../../domain/repositories/system-roadmap.repository.js';

const MAX_BODY_BYTES = 256 * 1024;
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class SystemIntegrationCallbackService {
  constructor(
    @Inject(SYSTEM_INTEGRATION_REPOSITORY)
    private readonly integrations: SystemIntegrationRepository,
    @Inject(SYSTEM_ROADMAP_REPOSITORY)
    private readonly roadmap: SystemRoadmapRepository,
  ) {}

  async handle(
    integrationUuid: string,
    input: {
      timestamp: string;
      signature: string;
      body: string;
      eventId?: string;
      eventName?: string;
      keyVersion?: string;
    },
    provider: IntegrationProviderPort,
  ) {
    return this.enqueue(
      integrationUuid,
      input,
      provider,
    );
  }

  async enqueue(
    integrationUuid: string,
    input: {
      timestamp: string;
      signature: string;
      body: string;
      eventId?: string;
      eventName?: string;
      keyVersion?: string;
    },
    provider: IntegrationProviderPort,
  ) {
    const body = input.body;
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES)
      throw new BadRequestException('Callback payload exceeds limit');

    const integration = await this.integrations.get(integrationUuid);
    if (!integration) throw new BadRequestException('Integration not found');
    if (integration.state === 'DISABLED')
      throw new UnauthorizedException('Integration is disabled');

    const timestampMs = Date.parse(input.timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > REPLAY_WINDOW_MS
    )
      throw new UnauthorizedException('Expired callback');

    if (!provider.verifySignature)
      throw new UnauthorizedException(
        'Callback signature verification is not configured',
      );

    let verified = false;
    try {
      verified = await provider.verifySignature({
        timestamp: input.timestamp,
        body,
        signature: input.signature,
        keyVersion: input.keyVersion,
        secretRef: integration.secretRef,
      });
    } catch {
      verified = false;
    }
    if (!verified)
      throw new UnauthorizedException('Invalid callback signature');

    if (!provider.normalizeInbound)
      throw new BadRequestException(
        'Integration callback capability is not configured',
      );

    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      throw new BadRequestException('Callback payload is invalid JSON');
    }

    let event: ReturnType<NonNullable<IntegrationProviderPort['normalizeInbound']>>;
    try {
      event = provider.normalizeInbound(parsed);
    } catch {
      throw new BadRequestException('Callback payload cannot be normalized');
    }

    const eventKey = input.eventId?.trim() || event.eventKey;
    if (!eventKey || eventKey.length > 180)
      throw new BadRequestException('Callback event identity is invalid');

    const payloadHash = createHash('sha256').update(body).digest('hex');
    const eventName = input.eventName?.trim() || event.eventName;
    const reserved = await this.roadmap.idempotency.reserve({
      uuid: randomUUID(),
      integrationId: integration.id,
      eventKey,
      eventName,
      eventVersion: event.eventVersion,
      payloadHash,
      status: 'PROCESSING',
      attempt: 0,
      processedAt: null,
      lastErrorCode: null,
    });

    if (!reserved.created) {
      if (reserved.record.payloadHash !== payloadHash)
        throw new UnauthorizedException('Callback identity collision');
      if (reserved.record.status === 'PROCESSED')
        return { status: 'DUPLICATE', eventKey };
      if (reserved.record.status === 'PROCESSING')
        return { status: 'ALREADY_QUEUED', eventKey };
    }

    const existingEvent = await this.roadmap.event.getByKey(
      integration.id,
      eventKey,
    );
    if (existingEvent) {
      await this.roadmap.idempotency.update(reserved.record.uuid, {
        status: existingEvent.status === 'PROCESSED' ? 'PROCESSED' : 'PROCESSING',
        processedAt: existingEvent.processedAt,
      });
      return {
        status: existingEvent.status === 'PROCESSED' ? 'DUPLICATE' : 'ALREADY_QUEUED',
        eventKey,
        eventUuid: existingEvent.uuid,
      };
    }

    try {
      const created = await this.roadmap.event.create({
        uuid: randomUUID(),
        integrationId: integration.id,
        eventKey,
        eventName,
        eventVersion: event.eventVersion,
        payload: {
          ...event.payload,
          aggregateType: event.aggregateType,
          aggregateUuid: event.aggregateUuid,
        },
        payloadHash,
        idempotencyKey: eventKey,
        status: 'RECEIVED',
        occurredAt: event.occurredAt,
        processedAt: null,
      });

      await this.roadmap.idempotency.update(reserved.record.uuid, {
        status: 'PROCESSING',
        attempt: reserved.record.attempt,
        lastErrorCode: null,
      });
      return {
        status: 'ACCEPTED',
        eventKey,
        eventUuid: created.uuid,
      };
    } catch {
      await this.roadmap.idempotency.update(reserved.record.uuid, {
        status: 'FAILED',
        lastErrorCode: 'CALLBACK_ENQUEUE_FAILED',
        attempt: reserved.record.attempt + 1,
      });
      throw new BadRequestException('Callback could not be queued');
    }
  }

  async processQueuedEvent(integrationId: bigint, eventUuid: string) {
    const events = await this.roadmap.event.list(integrationId, 'RECEIVED', 25);
    const event = events.find((item) => item.uuid === eventUuid);
    if (!event) return null;
    await this.roadmap.event.update(event.uuid, {
      status: 'PROCESSED',
      processedAt: new Date(),
    });
    const idempotency = await this.roadmap.idempotency.reserve({
      uuid: randomUUID(),
      integrationId,
      eventKey: event.eventKey,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      payloadHash: event.payloadHash,
      status: 'PROCESSED',
      attempt: 1,
      processedAt: new Date(),
      lastErrorCode: null,
    });
    if (!idempotency.created)
      await this.roadmap.idempotency.update(idempotency.record.uuid, {
        status: 'PROCESSED',
        processedAt: new Date(),
      });
    return event;
  }
}
