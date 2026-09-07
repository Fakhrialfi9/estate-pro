import { Injectable } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';
import type { SystemMetricsPort } from '../../domain/observability/system-metrics.port.js';

const meter = metrics.getMeter('estate-pro.system');
const operationCounter = meter.createCounter('system_operations_total', {
  description: 'System operational actions completed',
});
const operationDuration = meter.createHistogram(
  'system_operation_duration_ms',
  {
    description: 'System operation duration in milliseconds',
    unit: 'ms',
  },
);
const exportRows = meter.createCounter('system_export_rows_total', {
  description: 'Rows emitted by System exports',
});
const exportBytes = meter.createCounter('system_export_bytes_total', {
  description: 'Bytes emitted by System export artifacts',
  unit: 'By',
});
const webhookAttempts = meter.createCounter('system_webhook_attempts_total', {
  description: 'Outbound webhook attempts',
});
const webhookFailures = meter.createCounter('system_webhook_failures_total', {
  description: 'Outbound webhook failures',
});
const integrationOperations = meter.createCounter(
  'system_integration_operations_total',
  {
    description: 'Integration operations',
  },
);
const httpRequests = meter.createCounter('system_http_requests_total', {
  description: 'HTTP requests completed by the application',
});
const httpDuration = meter.createHistogram('system_http_request_duration_ms', {
  description: 'HTTP request duration in milliseconds',
  unit: 'ms',
});
const httpErrors = meter.createCounter('system_http_errors_total', {
  description: 'HTTP error responses',
});

type HttpSnapshot = {
  startedAt: string;
  requests: number;
  errors: number;
  latencyMs: number;
};

@Injectable()
export class SystemMetricsService implements SystemMetricsPort {
  private readonly httpSnapshot: HttpSnapshot = {
    startedAt: new Date().toISOString(),
    requests: 0,
    errors: 0,
    latencyMs: 0,
  };

  operation(name: string, status: 'success' | 'failure', durationMs?: number) {
    const attributes = { operation: name, status };
    operationCounter.add(1, attributes);
    if (durationMs !== undefined)
      operationDuration.record(durationMs, attributes);
  }

  exportCompleted(rows: number, bytes: number) {
    exportRows.add(Math.max(0, rows));
    exportBytes.add(Math.max(0, bytes));
  }

  webhookAttempt(status: 'success' | 'failure') {
    webhookAttempts.add(1, { status });
    if (status === 'failure') webhookFailures.add(1);
  }

  integrationOperation(name: string, status: 'success' | 'failure') {
    integrationOperations.add(1, { operation: name, status });
  }

  httpRequest(input: { method: string; status: number; durationMs: number }) {
    const statusClass =
      input.status >= 500 ? '5xx' : input.status >= 400 ? '4xx' : '2xx';
    const attributes = {
      method: input.method,
      status_class: statusClass,
    };
    httpRequests.add(1, attributes);
    httpDuration.record(input.durationMs, attributes);
    this.httpSnapshot.requests += 1;
    this.httpSnapshot.latencyMs += Math.max(0, input.durationMs);
    if (input.status >= 400) {
      httpErrors.add(1, attributes);
      this.httpSnapshot.errors += 1;
    }
  }

  httpSnapshotView() {
    return {
      startedAt: this.httpSnapshot.startedAt,
      requests: this.httpSnapshot.requests,
      errors: this.httpSnapshot.errors,
      averageLatencyMs: this.httpSnapshot.requests
        ? Math.round(this.httpSnapshot.latencyMs / this.httpSnapshot.requests)
        : 0,
    };
  }
}
