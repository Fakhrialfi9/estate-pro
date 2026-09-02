import { Controller, Get, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AccessTokenClaims } from '../../../common/security/access-token-verifier.port.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { JwtAuthGuard } from '../auth/security/jwt-auth.guard.js';
import { AnalyticsService } from './application/analytics.service.js';
import { AnalyticsQueryDto } from './application/dto/analytics-query.dto.js';
import { ANALYTICS_EXPORT_PERMISSION, ANALYTICS_FORECAST_PERMISSION, ANALYTICS_READ_PERMISSION, ANALYTICS_REVENUE_READ_PERMISSION } from './domain/policies/analytics-scope.policy.js';

type AuthenticatedRequest = Request & { user?: AccessTokenClaims };

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(ANALYTICS_READ_PERMISSION)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('leads')
  @ApiOperation({ summary: 'Lead analytics', description: 'Read-only lead volume, lifecycle, aging, funnel and assignment metrics.' })
  getLeads(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.leads(query, this.user(request));
  }

  @Get('acquisition')
  @ApiOperation({ summary: 'Source and campaign analytics', description: 'Read-only acquisition source and campaign performance metrics.' })
  getAcquisition(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.acquisition(query, this.user(request));
  }

  @Get('conversion')
  @ApiOperation({ summary: 'Conversion analytics', description: 'Lead-to-opportunity, opportunity-to-deal and cohort conversion metrics.' })
  getConversion(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.conversion(query, this.user(request));
  }

  @Get('pipeline')
  @ApiOperation({ summary: 'Pipeline analytics', description: 'Pipeline inventory, stage velocity, opportunity aging and value analytics.' })
  getPipeline(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.pipeline(query, this.user(request));
  }

  @Get('property-agent')
  @ApiOperation({ summary: 'Property and agent analytics', description: 'Property inventory, listings, lifecycle, workload, activity, conversion and scorecard metrics.' })
  getPropertyAgent(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.propertyAndAgent(query, this.user(request));
  }

  @Get('sales-revenue')
  @RequirePermissions(ANALYTICS_REVENUE_READ_PERMISSION)
  @ApiOperation({ summary: 'Sales and revenue analytics', description: 'Financially sensitive sales, closed revenue and deal-value reports.' })
  getSalesRevenue(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.salesAndRevenue(query, this.user(request));
  }

  @Get('sla')
  @ApiOperation({ summary: 'SLA analytics', description: 'Response, qualification and sales-cycle SLA reporting.' })
  getSla(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.sla(query, this.user(request));
  }

  @Get('forecast')
  @RequirePermissions(ANALYTICS_FORECAST_PERMISSION)
  @ApiOperation({ summary: 'Forecast analytics', description: 'Deterministic explainable baseline using historical average and weighted open pipeline.' })
  getForecast(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto) {
    return this.analytics.forecast(query, this.user(request));
  }

  @Get('export')
  @RequirePermissions(ANALYTICS_EXPORT_PERMISSION)
  @ApiOperation({ summary: 'CSV analytics export', description: 'Bounded export of a previously supported analytics report.' })
  @ApiQuery({ name: 'report', required: true, enum: ['leads', 'acquisition', 'conversion', 'pipeline', 'property-agent', 'sales-revenue', 'sla', 'forecast'] })
  async export(@Req() request: AuthenticatedRequest, @Query() query: AnalyticsQueryDto, @Query('report') report: string, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    const result = await this.analytics.exportCsv(query, this.user(request), report);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return new StreamableFile(Buffer.from(result.content, 'utf8'));
  }

  private user(request: AuthenticatedRequest): AccessTokenClaims {
    if (!request.user?.sub) throw new Error('Authenticated actor missing');
    return request.user;
  }
}
