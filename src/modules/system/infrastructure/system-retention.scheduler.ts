import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemRetentionService } from '../application/services/system-retention.service.js';

@Injectable()
export class SystemRetentionScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

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

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  isHealthy(): boolean {
    return this.timer !== undefined;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
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
    } finally {
      this.running = false;
    }
  }
}
