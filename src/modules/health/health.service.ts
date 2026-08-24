import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma/prisma.service.js';

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
  constructor(private readonly prisma: PrismaService) {}

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
      await this.prisma.$queryRaw`SELECT 1`;

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
