import { Inject, Injectable } from '@nestjs/common';
import type { AccessTokenClaims } from '../../common/security/access-token-verifier.port.js';
import {
  SYSTEM_OPERATIONS_PORT,
  type SystemOperationsPort,
} from '../system/domain/operations/system-operations.port.js';
import { AnalyticsService } from '../analytics/analytics.module.js';
import type { ExecutiveDashboardQueryDto } from './executive-dashboard.query.dto.js';
import type {
  AgentActivityKpi,
  AgentConversionKpi,
  AgentDashboardData,
  AgentPropertyKpi,
  AgentScorecardKpi,
  AgentWorkloadKpi,
  CrmAcquisitionKpi,
  CrmAssignmentKpi,
  CrmConversionKpi,
  CrmDashboardData,
  CrmFunnelKpi,
  CrmLeadVolumeKpi,
  CrmLifecycleKpi,
  CrmAgingKpi,
  CrmSlaKpi,
  DashboardOperationalResponse,
  DashboardPeriod,
  DashboardSectionResponse,
  ExecutiveDashboardResponse,
  PropertyAgingKpi,
  PropertyDashboardData,
  PropertyInventoryKpi,
  PropertyLifecycleKpi,
  PropertyListingKpi,
  SalesAgingKpi,
  SalesAverageDealKpi,
  SalesConversionKpi,
  SalesDashboardData,
  SalesFunnelKpi,
  SalesPipelineKpi,
  SalesVelocityKpi,
} from './executive-dashboard.types.js';
