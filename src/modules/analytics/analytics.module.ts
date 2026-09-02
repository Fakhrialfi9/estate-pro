import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuthorizationModule } from '../../common/security/authorization.module.js';
import { AnalyticsController } from './presentation/analytics.controller.js';
import { AnalyticsService } from './application/analytics.service.js';
import { AnalyticsScopePolicy } from './domain/policies/analytics-scope.policy.js';
import { ANALYTICS_QUERY_PORT } from './domain/analytics.types.js';
import { PrismaAnalyticsQueryRepository } from './infrastructure/prisma-analytics-query.repository.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsScopePolicy,
    PrismaAnalyticsQueryRepository,
    {
      provide: ANALYTICS_QUERY_PORT,
      useExisting: PrismaAnalyticsQueryRepository,
    },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
