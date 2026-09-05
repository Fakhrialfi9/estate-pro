import { Injectable, NotFoundException } from '@nestjs/common';
import type { IntegrationProviderPort } from '../../domain/integration/integration.contracts.js';
import type { IntegrationRetryMetadata } from '../../domain/integration/integration-operation.contracts.js';
import type { SystemRoadmapRepository } from '../../domain/repositories/system-roadmap.repository.js';
import type { SystemIntegrationService } from './system-integration.service.js';

export type RetryPolicy = Readonly<{
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  deadlineMs: number;
}>;

export const DEFAULT_INTEGRATION_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
  jitterRatio: 0.2,
  deadlineMs: 15_000,
};

@Injectable()
export class SystemIntegrationReliabilityService {
  constructor(
    private readonly integrations: SystemIntegrationService,
    private readonly roadmap: SystemRoadmapRepository,
  ) {}

  isRetryable(error: unknown): boolean {
    if (!(error instanceof Error)) return true;
    const message = error.message.toLowerCase();
    return (
      !/(^|\b)(400|401|403|404|409|422)(\b|$)/.test(message) &&
      !/(invalid|forbidden|unauthorized|not found|conflict|validation)/.test(
        message,
      )
    );
  }

  delayMs(
    attempt: number,
    policy: RetryPolicy = DEFAULT_INTEGRATION_RETRY_POLICY,
  ): number {
    const boundedAttempt = Math.max(0, attempt);
    const exponential = Math.min(
      policy.maxDelayMs,
      policy.baseDelayMs * 2 ** boundedAttempt,
    );
    const jitter = exponential * policy.jitterRatio;
    return Math.max(
      0,
      Math.round(exponential - jitter + Math.random() * jitter * 2),
    );
  }

  async execute<T>(
    integrationUuid: string,
    operation: (provider: IntegrationProviderPort) => Promise<T>,
    policy: RetryPolicy = DEFAULT_INTEGRATION_RETRY_POLICY,
  ): Promise<{ value: T; retry: IntegrationRetryMetadata }> {
    const provider = await this.integrations.providerFor(integrationUuid);
    const startedAt = Date.now();
    let lastError: unknown;
    for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
      const runtime = await this.integrations.runtimeFor(integrationUuid);
      if (runtime.circuitState === 'OPEN') {
        if (!runtime.nextRetryAt || runtime.nextRetryAt > new Date()) {
          throw new Error('Integration circuit breaker is open');
        }
        await this.roadmap.runtime.update(runtime.integrationId, {
          circuitState: 'HALF_OPEN',
          halfOpenAt: new Date(),
        });
      }
      try {
        if (Date.now() - startedAt > policy.deadlineMs)
          throw new Error('Integration operation deadline exceeded');
        const value = await operation(provider);
        await this.roadmap.runtime.update(runtime.integrationId, {
          circuitState: 'CLOSED',
          failureCount: 0,
          successCount: runtime.successCount + 1,
          openedAt: null,
          halfOpenAt: null,
          nextRetryAt: null,
          lastOperationAt: new Date(),
          lastOperationStatus: 'SUCCEEDED',
        });
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
        const nextAttemptAt = retryable
          ? new Date(Date.now() + this.delayMs(attempt, policy))
          : null;
        const failures = runtime.failureCount + 1;
        const open = failures >= 5;
        await this.roadmap.runtime.update(runtime.integrationId, {
          failureCount: failures,
          circuitState: open ? 'OPEN' : runtime.circuitState,
          openedAt: open ? new Date() : runtime.openedAt,
          nextRetryAt:
            nextAttemptAt ??
            (open ? new Date(Date.now() + 30_000) : runtime.nextRetryAt),
          lastOperationAt: new Date(),
          lastOperationStatus: 'FAILED',
        });
        if (!retryable) break;
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(0, (nextAttemptAt?.getTime() ?? Date.now()) - Date.now()),
          ),
        );
      }
    }
    if (lastError instanceof Error) throw lastError;
    throw new Error('Integration operation failed');
  }

  async providerHealth(integrationUuid: string) {
    const provider = await this.integrations.providerFor(integrationUuid);
    if (!provider.health)
      throw new NotFoundException(
        'Provider health capability is not implemented',
      );
    const result = await provider.health();
    const runtime = await this.integrations.runtimeFor(integrationUuid);
    await this.roadmap.runtime.update(runtime.integrationId, {
      lastHealthAt: new Date(),
      lastOperationStatus: result.ok ? 'HEALTHY' : 'UNHEALTHY',
    });
    return result;
  }
}
