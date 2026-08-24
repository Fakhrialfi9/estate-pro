import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

const HEALTH_ROUTE_SEGMENT = '/health/';

const isHealthRequest = (request: Request): boolean => {
  const candidates = [request.path, request.originalUrl, request.url];

  return candidates.some((value) => {
    if (typeof value !== 'string') {
      return false;
    }

    const path = value.split('?')[0];
    return path.includes(HEALTH_ROUTE_SEGMENT);
  });
};

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<Request>();
      if (isHealthRequest(request)) {
        return true;
      }
    }

    return super.shouldSkip(context);
  }
}
