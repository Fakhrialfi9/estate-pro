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
    },
    provider: IntegrationProviderPort,
  ) {
    const body = input.body;
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES)
      throw new BadRequestException('Callback payload exceeds limit');
    const timestampMs = Date.parse(input.timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > REPLAY_WINDOW_MS
    )
      throw new UnauthorizedException('Expired callback');
    if (
      !provider.verifySignature ||
      !provider.verifySignature({
        timestamp: input.timestamp,
        body,
        signature: input.signature,
      })
    )
      throw new UnauthorizedException('Invalid callback signature');
    const integration = await this.integrations.get(integrationUuid);
    if (!integration) throw new BadRequestException('Integration not found');
    if (!provider.normalizeInbound)
      throw new BadRequestException(
        'Integration callback capability is not configured',
      );
    const event = provider.normalizeInbound(JSON.parse(body));
    const eventKey = input.eventId?.trim() || event.eventKey;
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const reserved = await this.roadmap.idempotency.reserve({
      uuid: randomUUID(),
      integrationId: integration.id,
      eventKey,
      eventName: input.eventName?.trim() || event.eventName,
      eventVersion: event.eventVersion,
      payloadHash,
      status: 'PROCESSING',
      attempt: 1,
      processedAt: null,
      lastErrorCode: null,
    });
    if (!reserved.created) {
      if (reserved.record.payloadHash !== payloadHash)
        throw new UnauthorizedException('Callback identity collision');
      if (reserved.record.status === 'PROCESSED')
        return { status: 'DUPLICATE', eventKey };
    }
    try {
      const created = await this.roadmap.event.create({
        uuid: randomUUID(),
        integrationId: integration.id,
        eventKey,
        eventName: event.eventName,
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
        status: 'PROCESSED',
        processedAt: new Date(),
        attempt: reserved.record.attempt + 1,
        lastErrorCode: null,
      });
      await this.roadmap.event.update(created.uuid, {
        status: 'PROCESSED',
        processedAt: new Date(),
      });
      return { status: 'ACCEPTED', eventKey, eventUuid: created.uuid };
    } catch {
      await this.roadmap.idempotency.update(reserved.record.uuid, {
        status: 'FAILED',
        lastErrorCode: 'CALLBACK_PROCESSING_FAILED',
        attempt: reserved.record.attempt + 1,
      });
      throw new BadRequestException('Callback processing failed');
    }
  }
}
