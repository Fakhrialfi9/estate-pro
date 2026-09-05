import { Inject, Injectable } from '@nestjs/common';
import type { AccessTokenClaims } from '../../common/security/access-token-verifier.port.js';
import {
  SYSTEM_OPERATIONS_PORT,
  type SystemOperationsPort,
} from '../system/domain/operations/system-operations.port.js';
import { AnalyticsService } from '../analytics/application/analytics.service.js';
import type { ExecutiveDashboardQueryDto } from './executive-dashboard.query.dto.js';
import type { ExecutiveDashboardResponse } from './dashboard.types.js';

type AnalyticsData = Record<string, unknown>;

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
      from: leads.meta.from,
      to: leads.meta.to,
    };
    const leadData: AnalyticsData = leads.data[0] ?? {};
    const pipelineData: AnalyticsData = pipeline.data[0] ?? {};
    const propertyData: AnalyticsData = propertyAndAgent.data[0] ?? {};

    return {
      generatedAt: new Date().toISOString(),
      period,
      kpi: {
        property: {
          inventory: propertyData.inventory ?? [],
          listings: propertyData.listings ?? [],
          lifecycle: propertyData.lifecycle ?? {},
          aging: propertyData.aging ?? {},
        },
        crm: {
          volume: leadData.volume ?? [],
          lifecycle: leadData.lifecycle ?? {},
          aging: leadData.aging ?? {},
          funnel: leadData.funnel ?? [],
        },
        sales: {
          pipeline: pipelineData.pipeline ?? [],
          value: pipelineData.value ?? [],
          conversion: conversion.data[0] ?? {},
        },
        agents: {
          workload: propertyData.workload ?? [],
          activity: propertyData.activity ?? [],
          conversion: propertyData.conversion ?? [],
        },
      },
      operations: {
        status: diagnostics.status,
        components: diagnostics.components,
      },
    };
  }
}
