import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE_HEALTH_CHECK,
  type HealthDependency,
} from './health.dependencies.js';

export interface HealthCheck {
  status: 'up' | 'down';
}

export interface HealthResponse {
  status: 'ok' | 'error';
  checks: {
    application: HealthCheck;
    database?: HealthCheck;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE_HEALTH_CHECK)
    private readonly databaseHealth: HealthDependency,
  ) {}

  liveness(): HealthResponse {
    return {
      status: 'ok',
      checks: {
        application: { status: 'up' },
      },
    };
  }

  async readiness(): Promise<HealthResponse> {
    try {
      await this.databaseHealth.check();

      return {
        status: 'ok',
        checks: {
          application: { status: 'up' },
          database: { status: 'up' },
        },
      };
    } catch {
      return {
        status: 'error',
        checks: {
          application: { status: 'up' },
          database: { status: 'down' },
        },
      };
    }
  }
}
