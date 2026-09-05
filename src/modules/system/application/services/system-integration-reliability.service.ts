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
  circuitWindowMs: number;
  circuitOpenMs: number;
}>;

export const DEFAULT_INTEGRATION_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
  jitterRatio: 0.2,
  deadlineMs: 15_000,
  circuitFailureThreshold: 5,
  circuitWindowMs: 60_000,
  circuitOpenMs: 30_000,
};

@Injectable()
export class SystemIntegrationReliabilityService {
  private readonly halfOpenProbes = new Set<string>();
  private readonly failureWindows = new Map<string, number[]>();

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
    return /(timeout|timed out|aborted|econn|reset|socket|network|503|502|504|429|temporar|unavailable)/.test(
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

  retryAfterMs(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const value = (error as { retryAfterMs?: unknown }).retryAfterMs;
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(60_000, Math.max(0, Math.trunc(value)))
      : null;
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
        const value = await this.withTimeout(operation(provider), remainingMs);
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
        const window = this.failureWindows.get(integrationUuid) ?? [];
        const now = Date.now();
        const active = window.filter(
          (timestamp) => now - timestamp <= policy.circuitWindowMs,
        );
        active.push(now);
        this.failureWindows.set(integrationUuid, active);

        const retryable =
          this.isRetryable(error) && attempt + 1 < policy.maxAttempts;
        const retryAfter = this.retryAfterMs(error);
        const delay = retryAfter ?? this.delayMs(attempt, policy);
        const nextAttemptAt = retryable ? new Date(now + delay) : null;
        const open = active.length >= policy.circuitFailureThreshold;

        await this.roadmap.runtime.update(runtime.integrationId, {
          failureCount: active.length,
          circuitState: open ? 'OPEN' : runtime.circuitState,
          openedAt: open ? new Date() : runtime.openedAt,
          nextRetryAt: open
            ? new Date(now + policy.circuitOpenMs)
            : nextAttemptAt,
          lastOperationAt: new Date(),
          lastOperationStatus: 'FAILED',
        });

        if (!retryable)
          throw error instanceof Error
            ? error
            : new Error('Integration operation failed');

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

    throw lastError instanceof Error
      ? lastError
      : new Error('Integration operation failed');
  }

  async providerHealth(integrationUuid: string) {
    const provider = await this.integrations.providerFor(integrationUuid);
    const runtime = await this.integrations.runtimeFor(integrationUuid);
    if (!provider.health)
      throw new NotFoundException(
        'Provider health capability is not implemented',
      );
    const configuration =
      await this.integrations.providerConfiguration(integrationUuid);
    const started = Date.now();
    try {
      const result = await this.withTimeout(
        provider.health(configuration),
        3_000,
      );
      const status = result.ok
        ? result.latencyMs >= 1_000
          ? 'DEGRADED'
          : 'UP'
        : 'DOWN';
      await this.roadmap.runtime.update(runtime.integrationId, {
        lastHealthAt: new Date(),
        lastOperationStatus: status,
      });
      return {
        ...result,
        status,
        latencyMs: result.latencyMs ?? Date.now() - started,
      };
    } catch {
      await this.roadmap.runtime.update(runtime.integrationId, {
        lastHealthAt: new Date(),
        lastOperationStatus: 'UNKNOWN',
      });
      return {
        ok: false,
        status: 'UNKNOWN',
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
    const window = this.failureWindows.get(integrationUuid) ?? [];
    const now = Date.now();
    this.failureWindows.set(
      integrationUuid,
      window.filter(
        (timestamp) =>
          now - timestamp <= DEFAULT_INTEGRATION_RETRY_POLICY.circuitWindowMs,
      ),
    );
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

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Integration operation timeout')),
        timeoutMs,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
