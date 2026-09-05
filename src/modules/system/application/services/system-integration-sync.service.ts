import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CanonicalIntegrationRequest } from '../../domain/integration/integration-operation.contracts.js';
import { SYSTEM_ROADMAP_REPOSITORY, type SystemRoadmapRepository } from '../../domain/repositories/system-roadmap.repository.js';
import { SystemIntegrationReliabilityService } from './system-integration-reliability.service.js';
import { SystemIntegrationService } from './system-integration.service.js';

const MAX_PULL = 100;

@Injectable()
export class SystemIntegrationSyncService {
  constructor(
    private readonly integrations: SystemIntegrationService,
    private readonly reliability: SystemIntegrationReliabilityService,
    @Inject(SYSTEM_ROADMAP_REPOSITORY) private readonly roadmap: SystemRoadmapRepository,
  ) {}

  async push(actorUuid: string, integrationUuid: string, input: { resourceType: string; resourceUuid?: string; payload: Record<string, unknown>; idempotencyKey: string }) {
    const provider = await this.integrations.providerFor(integrationUuid);
    if (!provider.push) throw new BadRequestException('Provider does not support push synchronization');
    const request: CanonicalIntegrationRequest = {
      operationKey: 'sync.push', direction: 'PUSH', resourceType: input.resourceType, resourceUuid: input.resourceUuid,
      payload: input.payload, idempotencyKey: input.idempotencyKey, occurredAt: new Date(),
    };
    const result = await this.reliability.execute(integrationUuid, () => provider.push!(request));
    return { direction: 'PUSH', integrationUuid, actorUuid, result: result.value, attempts: result.retry.attempt };
  }

  async pull(actorUuid: string, integrationUuid: string, input: { resourceType: string; limit?: number }) {
    const provider = await this.integrations.providerFor(integrationUuid);
    if (!provider.pull) throw new BadRequestException('Provider does not support pull synchronization');
    const runtime = await this.integrations.runtimeFor(integrationUuid);
    const limit = Math.min(MAX_PULL, Math.max(1, input.limit ?? 50));
    const result = await this.reliability.execute(integrationUuid, () => provider.pull!({ resourceType: input.resourceType, cursor: runtime.syncCursor, limit }));
    await this.roadmap.runtime.update(runtime.integrationId, { syncCursor: result.value.nextCursor, lastSyncedAt: new Date(), lastOperationStatus: 'PULL_SUCCEEDED' });
    return { direction: 'PULL', integrationUuid, actorUuid, resourceType: input.resourceType, recordsRead: result.value.records.length, nextCursor: result.value.nextCursor };
  }

  async bidirectional(actorUuid: string, integrationUuid: string, input: { resourceType: string; resourceUuid?: string; payload?: Record<string, unknown>; idempotencyKey?: string; limit?: number }) {
    const pushResult = input.payload && input.idempotencyKey ? await this.push(actorUuid, integrationUuid, { resourceType: input.resourceType, resourceUuid: input.resourceUuid, payload: input.payload, idempotencyKey: input.idempotencyKey }) : null;
    const pullResult = await this.pull(actorUuid, integrationUuid, { resourceType: input.resourceType, limit: input.limit });
    return { direction: 'BIDIRECTIONAL', push: pushResult, pull: pullResult, checkpoint: pullResult.nextCursor };
  }

  async operationIdempotency(integrationUuid: string, key: string) {
    const integration = await this.integrations.get(integrationUuid);
    const hash = createHash('sha256').update(`${integration.uuid}:${key}`).digest('hex');
    return hash;
  }
}
