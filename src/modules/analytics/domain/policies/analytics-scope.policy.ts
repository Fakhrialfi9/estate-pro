import type { AnalyticsScope } from '../analytics.types.js';

export const ANALYTICS_READ_PERMISSION = 'analytics.read';
export const ANALYTICS_GLOBAL_READ_PERMISSION = 'analytics.read.all';
export const ANALYTICS_REVENUE_READ_PERMISSION = 'analytics.revenue.read';
export const ANALYTICS_EXPORT_PERMISSION = 'analytics.export';
export const ANALYTICS_FORECAST_PERMISSION = 'analytics.forecast';
export const ANALYTICS_ADMIN_PERMISSION = 'analytics.manage';

type AnalyticsAuthorizationSubject = {
  readonly sub: string;
  readonly permissions?: readonly string[] | undefined;
};

const permissionsOf = (
  user: AnalyticsAuthorizationSubject,
): ReadonlySet<string> => new Set(user.permissions ?? []);

export class AnalyticsScopePolicy {
  resolve(user: AnalyticsAuthorizationSubject): AnalyticsScope {
    const permissions = permissionsOf(user);
    const global =
      permissions.has(ANALYTICS_GLOBAL_READ_PERMISSION) ||
      permissions.has(ANALYTICS_ADMIN_PERMISSION);
    return global
      ? { kind: 'global', userUuid: user.sub }
      : { kind: 'agent', userUuid: user.sub };
  }

  canReadRevenue(user: AnalyticsAuthorizationSubject): boolean {
    const permissions = permissionsOf(user);
    return (
      permissions.has(ANALYTICS_REVENUE_READ_PERMISSION) ||
      permissions.has(ANALYTICS_ADMIN_PERMISSION) ||
      permissions.has(ANALYTICS_GLOBAL_READ_PERMISSION)
    );
  }

  canExport(user: AnalyticsAuthorizationSubject): boolean {
    const permissions = permissionsOf(user);
    return (
      permissions.has(ANALYTICS_EXPORT_PERMISSION) ||
      permissions.has(ANALYTICS_ADMIN_PERMISSION)
    );
  }

  canForecast(user: AnalyticsAuthorizationSubject): boolean {
    const permissions = permissionsOf(user);
    return (
      permissions.has(ANALYTICS_FORECAST_PERMISSION) ||
      permissions.has(ANALYTICS_ADMIN_PERMISSION)
    );
  }
}
