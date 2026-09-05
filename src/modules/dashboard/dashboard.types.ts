export interface ExecutiveDashboardResponse {
  readonly generatedAt: string;
  readonly period: {
    readonly from: string;
    readonly to: string;
  };
  readonly kpi: {
    readonly property: Readonly<Record<string, unknown>>;
    readonly crm: Readonly<Record<string, unknown>>;
    readonly sales: Readonly<Record<string, unknown>>;
    readonly agents: Readonly<Record<string, unknown>>;
  };
  readonly operations: {
    readonly status: 'ok' | 'degraded';
    readonly components: Readonly<Record<string, 'up' | 'down' | 'unknown'>>;
  };
}
