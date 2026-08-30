import { Injectable } from '@nestjs/common';
import { metrics, SpanStatusCode, trace, type Span } from '@opentelemetry/api';

@Injectable()
export class RefreshTokenObservabilityService {
  private readonly tracer = trace.getTracer('estate-pro.auth.refresh-token');
  private readonly meter = metrics.getMeter('estate-pro.auth.refresh-token');
  private readonly successCounter = this.meter.createCounter(
    'auth_refresh_success_total',
    { description: 'Successful refresh-token rotations' },
  );
  private readonly failureCounter = this.meter.createCounter(
    'auth_refresh_failure_total',
    { description: 'Failed refresh-token operations' },
  );
  private readonly reuseCounter = this.meter.createCounter(
    'auth_refresh_reuse_detection_total',
    { description: 'Detected refresh-token reuse attempts' },
  );
  private readonly familyRevocationCounter = this.meter.createCounter(
    'auth_refresh_family_revocation_total',
    { description: 'Refresh-token family revocations' },
  );
  private readonly latencyHistogram = this.meter.createHistogram(
    'auth_refresh_latency_ms',
    {
      description: 'Refresh-token operation latency in milliseconds',
      unit: 'ms',
    },
  );

  start(requestId?: string): { span: Span; startedAt: number } {
    const span = this.tracer.startSpan('auth.refresh_token');
    if (requestId) span.setAttribute('http.request_id', requestId);
    return { span, startedAt: performance.now() };
  }

  recordSuccess(): void {
    this.successCounter.add(1);
  }

  recordFailure(): void {
    this.failureCounter.add(1);
  }

  recordReuseDetected(): void {
    this.reuseCounter.add(1);
  }

  recordFamilyRevocation(): void {
    this.familyRevocationCounter.add(1);
  }

  finish(span: Span, startedAt: number, success: boolean, error?: Error): void {
    this.latencyHistogram.record(performance.now() - startedAt);
    span.setStatus({
      code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      ...(error ? { message: error.name } : {}),
    });
    span.end();
  }
}
