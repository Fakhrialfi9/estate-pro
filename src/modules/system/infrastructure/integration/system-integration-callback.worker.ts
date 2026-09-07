import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SYSTEM_INTEGRATION_REPOSITORY, type SystemIntegrationRepository } from '../../domain/repositories/system-integration.repository.js';
import { SYSTEM_ROADMAP_REPOSITORY, type SystemRoadmapRepository } from '../../domain/repositories/system-roadmap.repository.js';
import { SystemIntegrationCallbackService } from '../../application/services/system-integration-callback.service.js';

const POLL_MS = 1_000;
const BATCH_SIZE = 25;

@Injectable()
export class SystemIntegrationCallbackWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemIntegrationCallbackWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    @Inject(SYSTEM_INTEGRATION_REPOSITORY)
    private readonly integrations: SystemIntegrationRepository,
    @Inject(SYSTEM_ROADMAP_REPOSITORY)
    private readonly roadmap: SystemRoadmapRepository,
    private readonly callbacks: SystemIntegrationCallbackService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    void this.poll();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    if (this.running) return;
    this.running = true;
    const startedAt = Date.now();
    let processed = 0;
    try {
      const integrations = await this.integrations.list(1, 100);
      for (const integration of integrations.items) {
        if (processed >= BATCH_SIZE) break;
        const events = await this.roadmap.event.list(
          integration.id,
          'RECEIVED',
          Math.min(BATCH_SIZE - processed, 25),
        );
        for (const event of events) {
          if (processed >= BATCH_SIZE) break;
          try {
            await this.callbacks.processQueuedEvent(integration.id, event.uuid);
            processed += 1;
          } catch (error) {
            this.logger.error('Inbound integration event processing failed', {
              integrationUuid: integration.uuid,
              eventUuid: event.uuid,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Inbound integration callback worker poll failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.logger.log(
        `Inbound callback worker processed=${processed} runtimeMs=${Date.now() - startedAt}`,
      );
      this.running = false;
    }
  }
}
