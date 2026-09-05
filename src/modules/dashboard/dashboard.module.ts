import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { SystemModule } from '../system/system.module.js';
import { ExecutiveDashboardController } from './executive-dashboard.controller.js';
import { ExecutiveDashboardService } from './executive-dashboard.service.js';

@Module({
  imports: [AnalyticsModule, SystemModule],
  controllers: [ExecutiveDashboardController],
  providers: [ExecutiveDashboardService],
})
export class DashboardModule {}
