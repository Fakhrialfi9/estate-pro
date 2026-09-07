import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutomationNotificationDeliveryService } from '../../application/services/automation-notification-delivery.service.js';

@Injectable()
export class AutomationNotificationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly delivery: AutomationNotificationDeliveryService,
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
      await this.delivery.processDue(
        this.config.get<number>('automation.schedulerBatchSize', 25),
      );
    } finally {
      this.running = false;
    }
  }
}
