import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { CanonicalIntegrationRequest } from '../../domain/integration/integration-operation.contracts.js';
import {
  SYSTEM_INTEGRATION_OPERATION_RETRY_REPOSITORY,
  type SystemIntegrationOperationRetryRepository,
} from '../../domain/repositories/system-integration-operation-retry.repository.js';
import {
  SYSTEM_ROADMAP_REPOSITORY,
  type SystemRoadmapRepository,
} from '../../domain/repositories/system-roadmap.repository.js';
import { SystemIntegrationMappingService } from './system-integration-mapping.service.js';
import { SystemIntegrationReliabilityService } from './system-integration-reliability.service.js';
import { SystemIntegrationService } from './system-integration.service.js';

const MAX_PULL = 100;
const OPERATION_MAX_ATTEMPTS = 5;
const OPERATION_RETRY_INTERVAL_MS = 5_000;

@Injectable()
export class SystemIntegrationSyncService
  implements OnModuleInit, OnModuleDestroy
{
  private retryTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly integrations: SystemIntegrationService,
    private readonly reliability: SystemIntegrationReliabilityService,
    private readonly mapping: SystemIntegrationMappingService,
    @Inject(SYSTEM_ROADMAP_REPOSITORY)
    private readonly roadmap: SystemRoadmapRepository,
    @Inject(SYSTEM_INTEGRATION_OPERATION_RETRY_REPOSITORY)
    private readonly retryRepository: SystemIntegrationOperationRetryRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  onModuleInit(): void {
    this.retryTimer = setInterval(() => {
      void this.recoverDueOperations();
    }, OPERATION_RETRY_INTERVAL_MS);
    this.retryTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  async push(
    actorUuid: string,
    integrationUuid: string,
    input: {
      resourceType: string;
      resourceUuid?: string;
      payload: Record<string, unknown>;
      idempotencyKey: string;
    },
  ) {
    const provider = await this.integrations.providerFor(integrationUuid);
    if (!provider.push)
      throw new BadRequestException(
        'Provider does not support push synchronization',
      );
    const runtime = await this.integrations.runtimeFor(integrationUuid);
    this.mapping.validate(runtime.requestMapping, provider.version);
    const mappedPayload = this.mapping.map(
      input.payload,
      runtime.requestMapping,
    );
    const context =
      await this.integrations.providerConfiguration(integrationUuid);
    const existing = await this.roadmap.operation.getByIdempotency(
      runtime.integrationId,
      input.idempotencyKey,
    );
    if (existing) {
      if (existing.state === 'SUCCEEDED')
        return {
          direction: 'PUSH',
          integrationUuid,
          actorUuid,
          result: existing.responsePayload,
          attempts: existing.attempt,
          operationUuid: existing.uuid,
          idempotentReplay: true,
        };
      if (existing.state === 'RUNNING')
        throw new ConflictException('Integration operation is already running');
      if (existing.state === 'RETRY_SCHEDULED')
        return {
          direction: 'PUSH',
          integrationUuid,
          actorUuid,
          queued: true,
          operationUuid: existing.uuid,
          nextAttemptAt: existing.nextAttemptAt,
          attempts: existing.attempt,
        };
      if (existing.attempt >= existing.maxAttempts)
        throw new ConflictException(
          'Integration operation retry limit exhausted',
        );
    }

    let operation = existing;
    if (!operation) {
      try {
        operation = await this.roadmap.operation.create({
          uuid: randomUUID(),
          integrationId: runtime.integrationId,
          operationKey: 'sync.push',
          direction: 'PUSH',
          idempotencyKey: input.idempotencyKey,
          attempt: 1,
          maxAttempts: OPERATION_MAX_ATTEMPTS,
          state: 'RUNNING',
          requestHash: hashJson({
            resourceType: input.resourceType,
            resourceUuid: input.resourceUuid,
            payload: mappedPayload,
          }),
          responseHash: null,
          requestPayload: {
            resourceType: input.resourceType,
            resourceUuid: input.resourceUuid,
            payload: mappedPayload,
          },
          responsePayload: null,
          nextAttemptAt: null,
          startedAt: new Date(),
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          metadata: { actorUuid },
        });
      } catch {
        const raced = await this.roadmap.operation.getByIdempotency(
          runtime.integrationId,
          input.idempotencyKey,
        );
        if (!raced)
          throw new ConflictException(
            'Integration operation could not be reserved',
          );
        operation = raced;
        if (raced.state === 'RUNNING')
          throw new ConflictException(
            'Integration operation is already running',
          );
      }
    } else if (operation.state === 'FAILED') {
      operation = await this.roadmap.operation.update(operation.uuid, {
        state: 'RUNNING',
        attempt: operation.attempt + 1,
        startedAt: new Date(),
        nextAttemptAt: null,
        errorCode: null,
        errorMessage: null,
      });
    }

    try {
      const request: CanonicalIntegrationRequest = {
        operationKey: 'sync.push',
        direction: 'PUSH',
        resourceType: input.resourceType,
        ...(input.resourceUuid ? { resourceUuid: input.resourceUuid } : {}),
        payload: mappedPayload,
        idempotencyKey: input.idempotencyKey,
        occurredAt: new Date(),
      };
      const result = await this.reliability.execute(integrationUuid, () =>
        provider.push!(request, context),
      );
      const response = {
        ...result.value,
        data: this.mapping.map(result.value.data, runtime.responseMapping),
      };
      await this.roadmap.operation.update(operation.uuid, {
        state: 'SUCCEEDED',
        attempt: operation.attempt,
        responseHash: hashJson(response),
        responsePayload: response,
        completedAt: new Date(),
        nextAttemptAt: null,
        errorCode: null,
        errorMessage: null,
      });
      return {
        direction: 'PUSH',
        integrationUuid,
        actorUuid,
        result: response,
        attempts: result.retry.attempt,
        operationUuid: operation.uuid,
        idempotentReplay: false,
      };
    } catch (error: unknown) {
      const retryable = this.reliability.isRetryable(error);
      const nextAttemptAt =
        retryable && operation.attempt < operation.maxAttempts
          ? new Date(Date.now() + this.reliability.delayMs(operation.attempt))
          : null;
      await this.roadmap.operation.update(operation.uuid, {
        state: nextAttemptAt ? 'RETRY_SCHEDULED' : 'FAILED',
        nextAttemptAt,
        completedAt: nextAttemptAt ? null : new Date(),
        errorCode: retryable
          ? 'PROVIDER_TRANSIENT_FAILURE'
          : 'PROVIDER_PERMANENT_FAILURE',
        errorMessage: safeError(error),
      });
      throw error;
    }
  }

  async pull(
    actorUuid: string,
    integrationUuid: string,
    input: { resourceType: string; limit?: number },
  ) {
    const provider = await this.integrations.providerFor(integrationUuid);
    if (!provider.pull)
      throw new BadRequestException(
        'Provider does not support pull synchronization',
      );
    const runtime = await this.integrations.runtimeFor(integrationUuid);
    this.mapping.validate(runtime.responseMapping, provider.version);
    const context =
      await this.integrations.providerConfiguration(integrationUuid);
    const limit = Math.min(MAX_PULL, Math.max(1, input.limit ?? 50));
    const cursor = runtime.syncCursor;
    const idempotencyKey = `sync.pull:${integrationUuid}:${cursor ?? 'initial'}:${input.resourceType}`;
    const existing = await this.roadmap.operation.getByIdempotency(
      runtime.integrationId,
      idempotencyKey,
    );
    if (existing?.state === 'SUCCEEDED')
      return {
        direction: 'PULL',
        integrationUuid,
        actorUuid,
        resourceType: input.resourceType,
        recordsRead: Array.isArray(existing.responsePayload?.records)
          ? existing.responsePayload.records.length
          : 0,
        records: Array.isArray(existing.responsePayload?.records)
          ? existing.responsePayload.records
          : [],
        nextCursor:
          typeof existing.responsePayload?.nextCursor === 'string'
            ? existing.responsePayload.nextCursor
            : null,
        operationUuid: existing.uuid,
        idempotentReplay: true,
      };
    if (existing?.state === 'RUNNING')
      throw new ConflictException('Integration operation is already running');
    if (existing?.state === 'RETRY_SCHEDULED')
      return {
        direction: 'PULL',
        integrationUuid,
        actorUuid,
        resourceType: input.resourceType,
        queued: true,
        operationUuid: existing.uuid,
        nextAttemptAt: existing.nextAttemptAt,
      };

    let operation = existing;
    if (!operation) {
      try {
        operation = await this.roadmap.operation.create({
          uuid: randomUUID(),
          integrationId: runtime.integrationId,
          operationKey: 'sync.pull',
          direction: 'PULL',
          idempotencyKey,
          attempt: 1,
          maxAttempts: OPERATION_MAX_ATTEMPTS,
          state: 'RUNNING',
          requestHash: hashJson({
            resourceType: input.resourceType,
            limit,
            cursor,
          }),
          responseHash: null,
          requestPayload: { resourceType: input.resourceType, limit, cursor },
          responsePayload: null,
          nextAttemptAt: null,
          startedAt: new Date(),
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          metadata: { actorUuid },
        });
      } catch {
        const raced = await this.roadmap.operation.getByIdempotency(
          runtime.integrationId,
          idempotencyKey,
        );
        if (!raced)
          throw new ConflictException(
            'Integration operation could not be reserved',
          );
        operation = raced;
      }
    } else {
      if (operation.attempt >= operation.maxAttempts)
        throw new ConflictException(
          'Integration operation retry limit exhausted',
        );
      operation = await this.roadmap.operation.update(operation.uuid, {
        state: 'RUNNING',
        attempt: operation.attempt + 1,
        startedAt: new Date(),
        nextAttemptAt: null,
        errorCode: null,
        errorMessage: null,
      });
    }

    try {
      const result = await this.reliability.execute(integrationUuid, () =>
        provider.pull!(
          {
            resourceType: input.resourceType,
            cursor,
            limit,
          },
          context,
        ),
      );
      const records = result.value.records.map((record) =>
        this.mapping.map(record, runtime.responseMapping),
      );
      await this.roadmap.runtime.update(runtime.integrationId, {
        syncCursor: result.value.nextCursor,
        lastSyncedAt: new Date(),
        lastOperationStatus: 'PULL_SUCCEEDED',
      });
      await this.roadmap.operation.update(operation.uuid, {
        state: 'SUCCEEDED',
        attempt: operation.attempt,
        responseHash: hashJson({
          records,
          nextCursor: result.value.nextCursor,
        }),
        responsePayload: { records, nextCursor: result.value.nextCursor },
        completedAt: new Date(),
        nextAttemptAt: null,
        errorCode: null,
        errorMessage: null,
      });
      return {
        direction: 'PULL',
        integrationUuid,
        actorUuid,
        resourceType: input.resourceType,
        recordsRead: records.length,
        records,
        nextCursor: result.value.nextCursor,
        operationUuid: operation.uuid,
        idempotentReplay: false,
      };
    } catch (error: unknown) {
      const retryable = this.reliability.isRetryable(error);
      const nextAttemptAt =
        retryable && operation.attempt < operation.maxAttempts
          ? new Date(Date.now() + this.reliability.delayMs(operation.attempt))
          : null;
      await this.roadmap.operation.update(operation.uuid, {
        state: nextAttemptAt ? 'RETRY_SCHEDULED' : 'FAILED',
        nextAttemptAt,
        completedAt: nextAttemptAt ? null : new Date(),
        errorCode: retryable
          ? 'PROVIDER_TRANSIENT_FAILURE'
          : 'PROVIDER_PERMANENT_FAILURE',
        errorMessage: safeError(error),
      });
      throw error;
    }
  }

  async bidirectional(
    actorUuid: string,
    integrationUuid: string,
    input: {
      resourceType: string;
      resourceUuid?: string;
      payload?: Record<string, unknown>;
      idempotencyKey?: string;
      limit?: number;
    },
  ) {
    const pushResult =
      input.payload && input.idempotencyKey
        ? await this.push(actorUuid, integrationUuid, {
            resourceType: input.resourceType,
            resourceUuid: input.resourceUuid,
            payload: input.payload,
            idempotencyKey: input.idempotencyKey,
          })
        : null;
    const pullResult = await this.pull(actorUuid, integrationUuid, {
      resourceType: input.resourceType,
      limit: input.limit,
    });
    return {
      direction: 'BIDIRECTIONAL',
      push: pushResult,
      pull: pullResult,
      checkpoint: pullResult.nextCursor,
    };
  }

  async operationIdempotency(integrationUuid: string, key: string) {
    const integration = await this.integrations.get(integrationUuid);
    return createHash('sha256')
      .update(`${integration.uuid}:${key}`)
      .digest('hex');
  }

  async retryOperation(actorUuid: string, operationUuid: string) {
    const integrations = await this.integrations.list(1, 100);
    for (const integration of integrations.items) {
      const runtime = await this.integrations.runtimeFor(integration.uuid);
      const operations = await this.roadmap.operation.list(
        runtime.integrationId,
        undefined,
        100,
      );
      const operation = operations.find((item) => item.uuid === operationUuid);
      if (!operation) continue;
      if (operation.state === 'SUCCEEDED')
        throw new ConflictException('Integration operation already succeeded');
      if (operation.state === 'RUNNING')
        throw new ConflictException('Integration operation is already running');
      if (operation.attempt >= operation.maxAttempts)
        throw new BadRequestException(
          'Integration operation retry limit exhausted',
        );
      const updated = await this.roadmap.operation.update(operationUuid, {
        state: 'RETRY_SCHEDULED',
        nextAttemptAt: new Date(),
        completedAt: null,
      });
      await this.audit.record({
        action: 'SYSTEM_INTEGRATION_SYNCED',
        actorUuid,
        subjectUuid: actorUuid,
        entityType: 'system_integration_operation',
        entityUuid: operationUuid,
        result: 'SUCCESS',
        reason: 'integration.operation.retry.scheduled',
      });
      return updated;
    }
    throw new NotFoundException('Integration operation not found');
  }

  private async recoverDueOperations(): Promise<void> {
    const integrations = await this.integrations.list(1, 100);
    for (const integration of integrations.items) {
      try {
        const runtime = await this.integrations.runtimeFor(integration.uuid);
        const operations = await this.retryRepository.claimDue(
          runtime.integrationId,
          new Date(),
          20,
        );
        for (const operation of operations) {
          void this.executeStoredOperation(integration.uuid, operation);
        }
      } catch {
        // One integration must not prevent retry processing for the remaining integrations.
      }
    }
  }

  private async executeStoredOperation(
    integrationUuid: string,
    operation: Awaited<
      ReturnType<SystemRoadmapRepository['operation']['list']>
    >[number],
  ) {
    try {
      const provider = await this.integrations.providerFor(integrationUuid);
      const runtime = await this.integrations.runtimeFor(integrationUuid);
      const context =
        await this.integrations.providerConfiguration(integrationUuid);
      const payload = operation.requestPayload ?? {};
      const result =
        operation.operationKey === 'sync.push'
          ? await this.retryPush(
              integrationUuid,
              provider,
              payload,
              operation.idempotencyKey,
              runtime.responseMapping,
              context,
            )
          : operation.operationKey === 'sync.pull'
            ? await this.retryPull(
                integrationUuid,
                provider,
                payload,
                runtime.responseMapping,
                context,
              )
            : null;
      if (result === null) throw new Error('Unsupported operation retry key');
      await this.roadmap.operation.update(operation.uuid, {
        state: 'SUCCEEDED',
        responseHash: hashJson(result),
        responsePayload: result,
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      });
    } catch (error: unknown) {
      const retryable = this.reliability.isRetryable(error);
      const nextAttemptAt =
        retryable && operation.attempt < operation.maxAttempts
          ? new Date(Date.now() + this.reliability.delayMs(operation.attempt))
          : null;
      await this.roadmap.operation.update(operation.uuid, {
        state: nextAttemptAt ? 'RETRY_SCHEDULED' : 'FAILED',
        nextAttemptAt,
        completedAt: nextAttemptAt ? null : new Date(),
        errorCode: retryable
          ? 'PROVIDER_TRANSIENT_FAILURE'
          : operation.attempt >= operation.maxAttempts
            ? 'OPERATION_RETRY_EXHAUSTED'
            : 'OPERATION_RETRY_FAILED',
        errorMessage: safeError(error),
      });
    }
  }

  private async retryPush(
    integrationUuid: string,
    provider: Awaited<ReturnType<SystemIntegrationService['providerFor']>>,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    responseMapping: Record<string, unknown>,
    context: { metadata: Record<string, unknown>; secretRef: string | null },
  ) {
    if (!provider.push)
      throw new Error('Provider does not support push synchronization');
    const input = payload as {
      resourceType?: string;
      resourceUuid?: string;
      payload?: Record<string, unknown>;
    };
    const request: CanonicalIntegrationRequest = {
      operationKey: 'sync.push',
      direction: 'PUSH',
      resourceType: input.resourceType ?? 'unknown',
      ...(input.resourceUuid ? { resourceUuid: input.resourceUuid } : {}),
      payload: input.payload ?? {},
      idempotencyKey,
      occurredAt: new Date(),
    };
    const result = await this.reliability.execute(integrationUuid, () =>
      provider.push!(request, context),
    );
    return {
      ...result.value,
      data: this.mapping.map(result.value.data, responseMapping),
    } as unknown as Record<string, unknown>;
  }

  private async retryPull(
    integrationUuid: string,
    provider: Awaited<ReturnType<SystemIntegrationService['providerFor']>>,
    payload: Record<string, unknown>,
    responseMapping: Record<string, unknown>,
    context: { metadata: Record<string, unknown>; secretRef: string | null },
  ) {
    if (!provider.pull)
      throw new Error('Provider does not support pull synchronization');
    const input = payload as {
      resourceType?: string;
      limit?: number;
      cursor?: string | null;
    };
    const result = await this.reliability.execute(integrationUuid, () =>
      provider.pull!(
        {
          resourceType: input.resourceType ?? 'unknown',
          limit: Math.min(MAX_PULL, Math.max(1, input.limit ?? 50)),
          cursor: input.cursor ?? null,
        },
        context,
      ),
    );
    const records = result.value.records.map((record) =>
      this.mapping.map(record, responseMapping),
    );
    const runtime = await this.integrations.runtimeFor(integrationUuid);
    await this.roadmap.runtime.update(runtime.integrationId, {
      syncCursor: result.value.nextCursor,
      lastSyncedAt: new Date(),
      lastOperationStatus: 'PULL_SUCCEEDED',
    });
    return {
      records,
      nextCursor: result.value.nextCursor,
    };
  }
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function safeError(error: unknown): string {
  if (!(error instanceof Error)) return 'Integration operation failed';
  return error.message
    .replace(
      /(token|secret|password|cookie|authorization)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    )
    .slice(0, 500);
}
