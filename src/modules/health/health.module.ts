import { Module } from '@nestjs/common';
import { DatabaseHealthService } from '../../infrastructure/database/database-health.service.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { HealthController } from './health.controller.js';
import { DATABASE_HEALTH_CHECK } from './health.dependencies.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: DATABASE_HEALTH_CHECK, useExisting: DatabaseHealthService },
  ],
  exports: [HealthService],
})
export class HealthModule {}
