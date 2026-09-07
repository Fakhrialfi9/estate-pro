import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_ADMIN_PERMISSION,
  ANALYTICS_EXPORT_PERMISSION,
  ANALYTICS_FORECAST_PERMISSION,
  ANALYTICS_GLOBAL_READ_PERMISSION,
  ANALYTICS_REVENUE_READ_PERMISSION,
  AnalyticsScopePolicy,
} from '../../src/modules/analytics/domain/policies/analytics-scope.policy.js';

describe('AnalyticsScopePolicy coverage', () => {
  const policy = new AnalyticsScopePolicy();

  it('resolves agent and global scopes', () => {
    expect(policy.resolve({ sub: 'user-1' })).toEqual({
      kind: 'agent',
      userUuid: 'user-1',
    });
    expect(
      policy.resolve({
        sub: 'user-1',
        permissions: [ANALYTICS_GLOBAL_READ_PERMISSION],
      }),
    ).toEqual({ kind: 'global', userUuid: 'user-1' });
    expect(
      policy.resolve({
        sub: 'user-1',
        permissions: [ANALYTICS_ADMIN_PERMISSION],
      }),
    ).toEqual({ kind: 'global', userUuid: 'user-1' });
  });

  it('covers revenue read permissions', () => {
    expect(policy.canReadRevenue({ sub: 'u' })).toBe(false);
    expect(
      policy.canReadRevenue({
        sub: 'u',
        permissions: [ANALYTICS_REVENUE_READ_PERMISSION],
      }),
    ).toBe(true);
    expect(
      policy.canReadRevenue({
        sub: 'u',
        permissions: [ANALYTICS_ADMIN_PERMISSION],
      }),
    ).toBe(true);
    expect(
      policy.canReadRevenue({
        sub: 'u',
        permissions: [ANALYTICS_GLOBAL_READ_PERMISSION],
      }),
    ).toBe(true);
  });

  it('covers export and forecast permissions', () => {
    expect(policy.canExport({ sub: 'u' })).toBe(false);
    expect(
      policy.canExport({
        sub: 'u',
        permissions: [ANALYTICS_EXPORT_PERMISSION],
      }),
    ).toBe(true);
    expect(
      policy.canExport({
        sub: 'u',
        permissions: [ANALYTICS_ADMIN_PERMISSION],
      }),
    ).toBe(true);

    expect(policy.canForecast({ sub: 'u' })).toBe(false);
    expect(
      policy.canForecast({
        sub: 'u',
        permissions: [ANALYTICS_FORECAST_PERMISSION],
      }),
    ).toBe(true);
    expect(
      policy.canForecast({
        sub: 'u',
        permissions: [ANALYTICS_ADMIN_PERMISSION],
      }),
    ).toBe(true);
  });
});
