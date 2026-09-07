export const SYSTEM_METRICS_PORT = Symbol('SYSTEM_METRICS_PORT');

export interface SystemMetricsPort {
  httpSnapshotView(): {
    readonly startedAt: string;
    readonly requests: number;
    readonly errors: number;
    readonly averageLatencyMs: number;
  };
}
