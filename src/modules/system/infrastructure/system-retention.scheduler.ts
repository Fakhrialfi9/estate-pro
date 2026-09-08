import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemRetentionService } from '../application/services/system-retention.service.js';

@Injectable()
export class SystemRetentionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemRetentionScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;
  private stopping = false;

  constructor(
    private readonly retention: SystemRetentionService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const interval = Math.max(
      60_000,
      Math.min(
        86_400_000,
        this.config.get<number>('system.retention.intervalMs', 3_600_000),
      ),
    );
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
    void this.tick();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.inFlight;
  }

  isHealthy(): boolean {
    return !this.stopping && this.timer !== undefined;
  }

  private tick(): Promise<void> {
    if (this.stopping || this.inFlight) return Promise.resolve();

    const run = this.runIteration();
    this.inFlight = run.finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async runIteration(): Promise<void> {
    try {
      await this.retention.run({
        activityRetentionDays: this.config.get<number>(
          'system.retention.activityDays',
          90,
        ),
        auditRetentionDays: this.config.get<number>(
          'system.retention.auditDays',
          365,
        ),
        batchSize: this.config.get<number>('system.retention.batchSize', 250),
      });
    } catch (error: unknown) {
      this.logger.error(
        'System retention scheduler iteration failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
