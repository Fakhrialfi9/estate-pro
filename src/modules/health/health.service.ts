import { Injectable } from '@nestjs/common';

import { DatabaseHealthService } from '../../infrastructure/database/database-health.service.js';

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
  constructor(private readonly databaseHealth: DatabaseHealthService) {}

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
