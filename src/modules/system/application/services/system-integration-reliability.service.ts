import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IntegrationProviderPort } from '../../domain/integration/integration.contracts.js';
import type { IntegrationRetryMetadata } from '../../domain/integration/integration-operation.contracts.js';
import {
  SYSTEM_ROADMAP_REPOSITORY,
  type SystemRoadmapRepository,
} from '../../domain/repositories/system-roadmap.repository.js';
import { SystemIntegrationService } from './system-integration.service.js';

export type RetryPolicy = Readonly<{
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  deadlineMs: number;
  circuitFailureThreshold: number;
  circuitOpenMs: number;
}>;

export const DEFAULT_INTEGRATION_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
  jitterRatio: 0.2,
  deadlineMs: 15_000,
  circuitFailureThreshold: 5,
  circuitOpenMs: 30_000,
};

@Injectable()
export class SystemIntegrationReliabilityService {
  private readonly halfOpenProbes = new Set<string>();

  constructor(
    private readonly integrations: SystemIntegrationService,
    @Inject(SYSTEM_ROADMAP_REPOSITORY)
    private readonly roadmap: SystemRoadmapRepository,
  ) {}

  isRetryable(error: unknown): boolean {
    if (!(error instanceof Error)) return true;
    const message = error.message.toLowerCase();
    if (
      /(400|401|403|404|409|422)/.test(message) ||
      /(invalid|forbidden|unauthorized|not found|conflict|validation|unsupported)/.test(
        message,
      )
    )
      return false;
    return /(timeout|timed out|aborted|econn|reset|socket|network|503|502|504|429|temporar|unavailable|circuit)/.test(
      message,
    );
  }

  delayMs(
    attempt: number,
    policy: RetryPolicy = DEFAULT_INTEGRATION_RETRY_POLICY,
    random = Math.random(),
  ): number {
    const boundedAttempt = Math.max(0, attempt);
    const exponential = Math.min(
      policy.maxDelayMs,
      policy.baseDelayMs * 2 ** boundedAttempt,
    );
    const jitter = exponential * Math.min(1, Math.max(0, policy.jitterRatio));
    return Math.max(0, Math.round(exponential - jitter + random * jitter * 2));
  }

  async execute<T>(
    integrationUuid: string,
    operation: (provider: IntegrationProviderPort) => Promise<T>,
    policy: RetryPolicy = DEFAULT_INTEGRATION_RETRY_POLICY,
  ): Promise<{ value: T; retry: IntegrationRetryMetadata }> {
    if (policy.maxAttempts < 1)
      throw new Error('Integration retry maxAttempts must be at least 1');

    const provider = await this.integrations.providerFor(integrationUuid);
    const startedAt = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
      const runtime = await this.integrations.runtimeFor(integrationUuid);
      await this.beforeAttempt(integrationUuid, runtime, policy);

      const remainingMs = policy.deadlineMs - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        lastError = new Error('Integration operation deadline exceeded');
        break;
      }

      try {
        const value = await this.withTimeout(
          operation(provider),
          remainingMs,
        );
        await this.recordSuccess(
          runtime.integrationId,
          integrationUuid,
          runtime,
        );
        return {
          value,
          retry: {
            attempt: attempt + 1,
            maxAttempts: policy.maxAttempts,
            nextAttemptAt: null,
            retryable: false,
            errorCode: null,
          },
        };
      } catch (error: unknown) {
        lastError = error;
        const retryable =
          this.isRetryable(error) && attempt + 1 < policy.maxAttempts;
        const delay = this.delayMs(attempt, policy);
        const nextAttemptAt = retryable
          ? new Date(Date.now() + delay)
          : null;
        const failures = runtime.failureCount + 1;
        const open = failures >= policy.circuitFailureThreshold;

        await this.roadmap.runtime.update(runtime.integrationId, {
          failureCount: failures,
          circuitState: open ? 'OPEN' : runtime.circuitState,
          openedAt: open ? new Date() : runtime.openedAt,
          nextRetryAt: open
            ? new Date(Date.now() + policy.circuitOpenMs)
            : nextAttemptAt,
          lastOperationAt: new Date(),
          lastOperationStatus: 'FAILED',
        });

        if (!retryable) {
          return this.failure(lastError, {
            attempt: attempt + 1,
            maxAttempts: policy.maxAttempts,
            nextAttemptAt: null,
            retryable: false,
            errorCode: this.errorCode(error),
          });
        }

        const waitMs = Math.min(
          delay,
          Math.max(0, policy.deadlineMs - (Date.now() - startedAt)),
        );
        if (waitMs <= 0) break;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } finally {
        this.halfOpenProbes.delete(integrationUuid);
      }
    }

    return this.failure(lastError ?? new Error('Integration operation failed'), {
      attempt: policy.maxAttempts,
      maxAttempts: policy.maxAttempts,
      nextAttemptAt: null,
      retryable: false,
      errorCode: this.errorCode(lastError),
    });
  }

  async providerHealth(integrationUuid: string) {
    const provider = await this.integrations.providerFor(integrationUuid);
    const runtime = await this.integrations.runtimeFor(integrationUuid);
    if (!provider.health)
      throw new NotFoundException('Provider health capability is not implemented');
    const started = Date.now();
    try {
      const result = await this.withTimeout(provider.health(), 3_000);
      await this.roadmap.runtime.update(runtime.integrationId, {
        lastHealthAt: new Date(),
        lastOperationStatus: result.ok ? 'HEALTHY' : 'UNHEALTHY',
      });
      return {
        ...result,
        latencyMs: result.latencyMs ?? Date.now() - started,
      };
    } catch {
      await this.roadmap.runtime.update(runtime.integrationId, {
        lastHealthAt: new Date(),
        lastOperationStatus: 'UNHEALTHY',
      });
      return {
        ok: false,
        latencyMs: Date.now() - started,
        code: 'HEALTH_TIMEOUT',
      };
    }
  }

  private async beforeAttempt(
    integrationUuid: string,
    runtime: Awaited<ReturnType<SystemIntegrationService['runtimeFor']>>,
    policy: RetryPolicy,
  ) {
    const now = Date.now();
    if (runtime.circuitState !== 'OPEN') return;
    if (runtime.nextRetryAt && runtime.nextRetryAt.getTime() > now)
      throw new Error('Integration circuit breaker is open');

    if (this.halfOpenProbes.has(integrationUuid))
      throw new Error('Integration circuit breaker is half-open');
    this.halfOpenProbes.add(integrationUuid);
    await this.roadmap.runtime.update(runtime.integrationId, {
      circuitState: 'HALF_OPEN',
      halfOpenAt: new Date(),
      nextRetryAt: new Date(now + policy.circuitOpenMs),
    });
  }

  private async recordSuccess(
    integrationId: bigint,
    integrationUuid: string,
    runtime: Awaited<ReturnType<SystemIntegrationService['runtimeFor']>>,
  ) {
    await this.roadmap.runtime.update(integrationId, {
      circuitState: 'CLOSED',
      failureCount: 0,
      successCount: runtime.successCount + 1,
      openedAt: null,
      halfOpenAt: null,
      nextRetryAt: null,
      lastOperationAt: new Date(),
      lastOperationStatus: 'SUCCEEDED',
    });
    this.halfOpenProbes.delete(integrationUuid);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Integration operation timeout')), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private errorCode(error: unknown) {
    if (!(error instanceof Error)) return null;
    if (/timeout|deadline|aborted/i.test(error.message)) return 'PROVIDER_TIMEOUT';
    if (/circuit breaker is open/i.test(error.message)) return 'CIRCUIT_OPEN';
    return 'INTEGRATION_OPERATION_FAILED';
  }

  private failure<T>(error: unknown, retry: IntegrationRetryMetadata): { value: T; retry: IntegrationRetryMetadata } {
    throw error instanceof Error ? error : new Error('Integration operation failed');
  }
}
