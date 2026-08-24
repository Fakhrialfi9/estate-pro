import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { HealthService } from './health.service.js';

@SkipThrottle({ default: true })
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  liveness(): ReturnType<HealthService['liveness']> {
    return this.healthService.liveness();
  }

  @Get('ready')
  readiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<Awaited<ReturnType<HealthService['readiness']>>> {
    return this.healthService.readiness().then((result) => {
      response.status(
        result.status === 'ok'
          ? HttpStatus.OK
          : HttpStatus.SERVICE_UNAVAILABLE,
      );
      return result;
    });
  }
}
