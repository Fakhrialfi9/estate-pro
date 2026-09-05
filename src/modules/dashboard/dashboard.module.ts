import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { SystemModule } from '../system/system.module.js';
import { ExecutiveDashboardController } from './executive-dashboard.controller.js';
import { ExecutiveDashboardService } from './executive-dashboard.service.js';

@Module({
  imports: [AnalyticsModule, SystemModule, AuthorizationModule],
  controllers: [ExecutiveDashboardController],
  providers: [ExecutiveDashboardService],
})
export class DashboardModule {}
