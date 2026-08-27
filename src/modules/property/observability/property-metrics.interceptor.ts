import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { metrics } from '@opentelemetry/api';
import { finalize, catchError, throwError } from 'rxjs';

const meter = metrics.getMeter('estate-pro.property');
const requestCounter = meter.createCounter('property_requests_total', {
  description: 'Property HTTP requests completed',
});
const requestDuration = meter.createHistogram('property_request_duration_ms', {
  description: 'Property HTTP request duration in milliseconds',
  unit: 'ms',
});
const errorCounter = meter.createCounter('property_errors_total', {
  description: 'Property HTTP errors',
});
const searchDuration = meter.createHistogram('property_search_duration_ms', {
  description: 'Property search duration in milliseconds',
  unit: 'ms',
});
const publishCounter = meter.createCounter('property_publish_total', {
  description: 'Property/listing publish attempts',
});
const mediaCounter = meter.createCounter('property_media_operations_total', {
  description: 'Property media operations',
});

const operationOf = (path: string): string => {
  if (path.includes('/search') || path.includes('/listings')) return 'search';
  if (path.includes('/publish')) return 'publish';
  if (path.includes('/media')) return 'media';
  if (path.includes('/properties')) return 'property';
  return 'property_master';
};

const statusCodeOf = (response: Response): number => response.statusCode;

@Injectable()
export class PropertyMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const path = request.route?.path ?? request.path;
    const operation = operationOf(path);
    const startedAt = performance.now();

    return next.handle().pipe(
      catchError((error: unknown) => {
        errorCounter.add(1, {
          operation,
          method: request.method,
          status: error instanceof Error ? '5xx' : '4xx',
        });
        return throwError(() => error);
      }),
      finalize(() => {
        const durationMs = performance.now() - startedAt;
        const attributes = {
          operation,
          method: request.method,
          status: String(statusCodeOf(response)),
        };
        requestCounter.add(1, attributes);
        requestDuration.record(durationMs, attributes);
        if (operation === 'search') searchDuration.record(durationMs, attributes);
        if (operation === 'publish') publishCounter.add(1, attributes);
        if (operation === 'media') mediaCounter.add(1, attributes);
      }),
    );
  }
}
