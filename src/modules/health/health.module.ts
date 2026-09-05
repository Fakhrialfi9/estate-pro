import { Module } from '@nestjs/common';
import { DatabaseHealthService } from '../../infrastructure/database/database-health.service.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { SYSTEM_HEALTH_PORT } from '../../common/contracts/health-system.port.js';
import { HealthController } from './health.controller.js';
import { DATABASE_HEALTH_CHECK } from './health.dependencies.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: DATABASE_HEALTH_CHECK, useExisting: DatabaseHealthService },
    {
      provide: SYSTEM_HEALTH_PORT,
      useFactory: (health: DatabaseHealthService) => ({
        checkDatabase: async () => {
          try {
            await health.check();
            return 'up' as const;
          } catch {
            return 'down' as const;
          }
        },
      }),
      inject: [DatabaseHealthService],
    },
  ],
  exports: [HealthService, SYSTEM_HEALTH_PORT],
})
export class HealthModule {}
