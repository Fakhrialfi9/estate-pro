import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutomationService } from '../../application/services/automation.service.js';
import type { AutomationRepository } from '../../domain/automation.ports.js';
import { AUTOMATION_REPOSITORY } from '../persistence/automation.repository.token.js';

@Injectable()
export class AutomationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly workerId = `automation-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

  constructor(
    private readonly automation: AutomationService,
    @Inject(AUTOMATION_REPOSITORY)
    private readonly repository: AutomationRepository,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.config.get<number>(
      'automation.pollIntervalMs',
      1000,
    );
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const leaseMs = this.config.get<number>('automation.leaseMs', 30_000);
      await this.repository.reclaimExpired(this.workerId, new Date());
      for (
        let index = 0;
        index < this.config.get<number>('automation.schedulerBatchSize', 25);
        index += 1
      ) {
        const result = await this.automation.processDue(this.workerId, leaseMs);
        if (!result) break;
      }
    } catch (error: unknown) {
      this.logger.error(
        'Automation scheduler iteration failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
