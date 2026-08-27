import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { metrics } from '@opentelemetry/api';
import { catchError, finalize, throwError } from 'rxjs';

type PropertyHttpRequest = Pick<Request, 'path' | 'method'>;

type StatusError = { readonly getStatus?: () => unknown };

const asUnknown = (value: unknown): unknown => value;

const isPropertyHttpRequest = (
  value: unknown,
): value is PropertyHttpRequest => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.path === 'string' && typeof candidate.method === 'string'
  );
};

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

const isPropertyPath = (path: string): boolean =>
  path === '/property' ||
  path.startsWith('/property/') ||
  path.includes('/property/');

const operationOf = (path: string, method: string): string => {
  if (
    path.includes('/search') ||
    (path.endsWith('/listings') && method === 'GET')
  ) {
    return 'search';
  }
  if (path.includes('/publish')) return 'publish';
  if (path.includes('/media')) return 'media';
  if (path.includes('/properties')) return 'property';
  return 'property_master';
};

const statusCodeOfError = (error: unknown): number => {
  if (!error || typeof error !== 'object') return 500;
  const candidate = error as StatusError;
  const getStatus = candidate.getStatus;
  if (!getStatus) return 500;
  const status = getStatus();
  return typeof status === 'number' && Number.isInteger(status) ? status : 500;
};

const statusClassOf = (status: number): string =>
  status >= 500 ? '5xx' : status >= 400 ? '4xx' : '2xx';

@Injectable()
export class PropertyMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const rawRequest = asUnknown(context.switchToHttp().getRequest());
    if (!isPropertyHttpRequest(rawRequest)) return next.handle();
    const request = rawRequest;
    const path = request.path;
    if (!isPropertyPath(path)) return next.handle();

    const response = context.switchToHttp().getResponse<Response>();
    const operation = operationOf(path, request.method);
    const startedAt = performance.now();

    return next.handle().pipe(
      catchError((error: unknown) => {
        const status = statusCodeOfError(error);
        errorCounter.add(1, {
          operation,
          method: request.method,
          status_class: statusClassOf(status),
        });
        return throwError(() => error);
      }),
      finalize(() => {
        const durationMs = performance.now() - startedAt;
        const status = response.statusCode;
        const attributes = {
          operation,
          method: request.method,
          status: String(status),
          status_class: statusClassOf(status),
        };
        requestCounter.add(1, attributes);
        requestDuration.record(durationMs, attributes);
        if (operation === 'search')
          searchDuration.record(durationMs, attributes);
        if (operation === 'publish') publishCounter.add(1, attributes);
        if (operation === 'media') mediaCounter.add(1, attributes);
      }),
    );
  }
}
