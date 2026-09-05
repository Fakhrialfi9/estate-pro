import { AnalyticsQueryDto } from '../analytics/application/dto/analytics-query.dto.js';

/**
 * Dashboard filters intentionally reuse the canonical Analytics query contract.
 * This keeps period, scope, pagination, and dimension validation consistent.
 */
export class ExecutiveDashboardQueryDto extends AnalyticsQueryDto {}
