import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, finalize, throwError } from 'rxjs';
import { SystemMetricsService } from './system-metrics.service.js';

@Injectable()
export class SystemHttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: SystemMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = performance.now();

    return next.handle().pipe(
      catchError((error: unknown) => throwError(() => error)),
      finalize(() => {
        this.metrics.httpRequest({
          method: request.method,
          status: response.statusCode,
          durationMs: performance.now() - startedAt,
        });
      }),
    );
  }
}
