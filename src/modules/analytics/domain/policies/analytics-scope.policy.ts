import type { AccessTokenClaims } from '../../../common/security/access-token-verifier.port.js';
import type { AnalyticsScope } from '../domain/analytics.types.js';

export const ANALYTICS_READ_PERMISSION = 'analytics.read';
export const ANALYTICS_GLOBAL_READ_PERMISSION = 'analytics.read.all';
export const ANALYTICS_REVENUE_READ_PERMISSION = 'analytics.revenue.read';
export const ANALYTICS_EXPORT_PERMISSION = 'analytics.export';
export const ANALYTICS_FORECAST_PERMISSION = 'analytics.forecast';
export const ANALYTICS_ADMIN_PERMISSION = 'analytics.manage';

export class AnalyticsScopePolicy {
  resolve(user: AccessTokenClaims): AnalyticsScope {
    const permissions = new Set(user.permissions ?? []);
    const global =
      permissions.has(ANALYTICS_GLOBAL_READ_PERMISSION) ||
      permissions.has(ANALYTICS_ADMIN_PERMISSION);
    return global
      ? { kind: 'global', userUuid: user.sub }
      : { kind: 'agent', userUuid: user.sub };
  }

  canReadRevenue(user: AccessTokenClaims): boolean {
    const permissions = new Set(user.permissions ?? []);
    return (
      permissions.has(ANALYTICS_REVENUE_READ_PERMISSION) ||
      permissions.has(ANALYTICS_ADMIN_PERMISSION) ||
      permissions.has(ANALYTICS_GLOBAL_READ_PERMISSION)
    );
  }

  canExport(user: AccessTokenClaims): boolean {
    const permissions = new Set(user.permissions ?? []);
    return (
      permissions.has(ANALYTICS_EXPORT_PERMISSION) ||
      permissions.has(ANALYTICS_ADMIN_PERMISSION)
    );
  }

  canForecast(user: AccessTokenClaims): boolean {
    const permissions = new Set(user.permissions ?? []);
    return (
      permissions.has(ANALYTICS_FORECAST_PERMISSION) ||
      permissions.has(ANALYTICS_ADMIN_PERMISSION)
    );
  }
}
