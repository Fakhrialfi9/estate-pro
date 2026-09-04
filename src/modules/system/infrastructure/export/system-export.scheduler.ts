import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemExportService } from '../../application/services/system-export.service.js';

@Injectable()
export class SystemExportScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly exports: SystemExportService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const interval = Math.max(
      250,
      Math.min(
        10_000,
        this.config.get<number>('automation.pollIntervalMs', 1000),
      ),
    );
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
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
      const maxConcurrent = this.config.get<number>(
        'system.export.maxConcurrent',
        2,
      );
      for (let i = 0; i < maxConcurrent; i += 1) {
        if (!(await this.exports.processQueued())) break;
      }
      await this.exports.cleanup(100);
    } finally {
      this.running = false;
    }
  }
}
