import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  SYSTEM_WEBHOOK_REPOSITORY,
  type SystemWebhookRepository,
} from '../../domain/repositories/system-webhook.repository.js';
import { SystemWebhookService } from '../../application/services/system-webhook.service.js';

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 25;

@Injectable()
export class SystemWebhookRetryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemWebhookRetryWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @Inject(SYSTEM_WEBHOOK_REPOSITORY)
    private readonly repository: SystemWebhookRepository,
    private readonly webhooks: SystemWebhookService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
    this.timer.unref?.();
    void this.poll();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const startedAt = Date.now();
    try {
      const now = new Date();
      const jobs = await this.repository.listDueDeliveries(now, BATCH_SIZE);
      let processed = 0;
      let failures = 0;
      let deadLetters = 0;

      for (const job of jobs) {
        const claimed = await this.repository.claimDelivery(job.delivery.uuid, now);
        if (!claimed) continue;

        const attempt = job.delivery.attemptCount + 1;
        const runningDelivery = await this.repository.updateDelivery(
          job.delivery.uuid,
          { attemptCount: attempt, state: 'DELIVERING' },
        );
        processed += 1;
        const waitMs = Math.max(
          0,
          now.getTime() - job.delivery.createdAt.getTime(),
        );
        try {
          const result = await this.webhooks.processQueuedDelivery(
            runningDelivery.uuid,
          );
          if (result?.state === 'DEAD_LETTER') deadLetters += 1;
        } catch (error: unknown) {
          failures += 1;
          this.logger.error(
            {
              deliveryUuid: runningDelivery.uuid,
              eventId: runningDelivery.eventId,
              attemptCount: runningDelivery.attemptCount,
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown webhook worker error',
            },
            'Webhook retry worker delivery failure',
          );
        }
        const runMs = Date.now() - startedAt;
        this.logger.log(
          {
            deliveryUuid: runningDelivery.uuid,
            queueWaitMs: waitMs,
            runMs,
            attemptCount: attempt,
            state: runningDelivery.state,
          },
          'Webhook retry delivery processed',
        );
      }

      if (jobs.length > 0 || processed > 0 || failures > 0 || deadLetters > 0) {
        this.logger.log(
          {
            queueDepthObserved: jobs.length,
            processed,
            failures,
            deadLetters,
            runMs: Date.now() - startedAt,
          },
          'Webhook retry queue poll completed',
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error ? error.stack : 'Unknown webhook queue error',
        'Webhook retry queue poll failed',
      );
    } finally {
      this.running = false;
    }
  }
}
