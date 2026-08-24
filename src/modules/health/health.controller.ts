import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';

import { SkipThrottle } from '../../infrastructure/rate-limit/throttler.js';
import { HealthService } from './health.service.js';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @SkipThrottle({ default: true })
  @HttpCode(HttpStatus.OK)
  liveness(): ReturnType<HealthService['liveness']> {
    return this.healthService.liveness();
  }

  @Get('ready')
  @SkipThrottle({ default: true })
  readiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<Awaited<ReturnType<HealthService['readiness']>>> {
    return this.healthService.readiness().then((result) => {
      response.status(
        result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
      );
      return result;
    });
  }
}
