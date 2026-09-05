import { Inject, Injectable } from '@nestjs/common';
import type { AccessTokenClaims } from '../../common/security/access-token-verifier.port.js';
import {
  SYSTEM_OPERATIONS_PORT,
  type SystemOperationsPort,
} from '../system/domain/operations/system-operations.port.js';
import { AnalyticsService } from '../analytics/application/analytics.service.js';
import type { ExecutiveDashboardQueryDto } from './executive-dashboard.query.dto.js';
import type { ExecutiveDashboardResponse } from './dashboard.types.js';

@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly analytics: AnalyticsService,
    @Inject(SYSTEM_OPERATIONS_PORT)
    private readonly operations: SystemOperationsPort,
  ) {}

  async get(
    query: ExecutiveDashboardQueryDto,
    user: AccessTokenClaims,
  ): Promise<ExecutiveDashboardResponse> {
    const analyticsQuery = {
      from: query.from,
      to: query.to,
      ownerUserUuid: query.ownerUserUuid,
      granularity: 'day' as const,
      page: 1,
      limit: 100,
    };
    const [leads, pipeline, propertyAndAgent, conversion, diagnostics] =
      await Promise.all([
        this.analytics.leads(analyticsQuery, user),
        this.analytics.pipeline(analyticsQuery, user),
        this.analytics.propertyAndAgent(analyticsQuery, user),
        this.analytics.conversion(analyticsQuery, user),
        this.operations.diagnostics(),
      ]);

    const period = {
      from: leads.from.toISOString(),
      to: leads.to.toISOString(),
    };

    return {
      generatedAt: new Date().toISOString(),
      period,
      kpi: {
        property: {
          inventory: propertyAndAgent.data.inventory,
          listings: propertyAndAgent.data.listings,
          lifecycle: propertyAndAgent.data.lifecycle,
          aging: propertyAndAgent.data.aging,
        },
        crm: {
          volume: leads.data.volume,
          lifecycle: leads.data.lifecycle,
          aging: leads.data.aging,
          funnel: leads.data.funnel,
        },
        sales: {
          pipeline: pipeline.data.pipeline,
          value: pipeline.data.value,
          conversion: conversion.data,
        },
        agents: {
          workload: propertyAndAgent.data.workload,
          activity: propertyAndAgent.data.activity,
          conversion: propertyAndAgent.data.conversion,
        },
      },
      operations: {
        status: diagnostics.status,
        components: diagnostics.components,
      },
    };
  }
}
