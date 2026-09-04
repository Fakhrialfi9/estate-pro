import { Injectable } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

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

@Injectable()
export class SystemMetricsService {
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
}
