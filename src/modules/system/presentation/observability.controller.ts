import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemObservabilityMetricsService } from '../application/services/system-observability-metrics.service.js';
import { SystemObservabilityService } from '../application/services/system-observability.service.js';
import { ObservabilityQueryDto } from './dto/observability-query.dto.js';

const metricsSchema = {
  type: 'object',
  additionalProperties: true,
};

@ApiTags('System Observability')
@ApiBearerAuth()
@Controller({ path: 'observability', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class ObservabilityController {
  constructor(
    private readonly observability: SystemObservabilityService,
    private readonly metrics: SystemObservabilityMetricsService,
  ) {}

  @Get('system-metrics')
  @RequirePermissions('system.observability.read')
  @ApiOperation({
    summary: 'Read bounded system HTTP, DB, application and queue metrics',
  })
  @ApiResponse({ status: 200, schema: metricsSchema })
  systemMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.metrics.systemMetrics(dates.from, dates.to, dates.granularity);
  }

  @Get('job-metrics')
  @RequirePermissions('system.observability.read')
  @ApiOperation({ summary: 'Read bounded background job metrics' })
  @ApiResponse({ status: 200, schema: metricsSchema })
  jobMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.metrics.jobMetrics(dates.from, dates.to, dates.granularity);
  }

  @Get('webhook-metrics')
  @RequirePermissions('system.observability.read')
  @ApiOperation({ summary: 'Read bounded webhook attempt and latency metrics' })
  @ApiResponse({ status: 200, schema: metricsSchema })
  webhookMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.metrics.webhookMetrics(dates.from, dates.to, dates.granularity);
  }

  @Get('integration-metrics')
  @RequirePermissions('system.observability.read')
  @ApiOperation({ summary: 'Read bounded integration operation metrics' })
  @ApiResponse({ status: 200, schema: metricsSchema })
  integrationMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.metrics.integrationMetrics(
      dates.from,
      dates.to,
      dates.granularity,
    );
  }

  @Get('import-export-metrics')
  @RequirePermissions('system.observability.read')
  @ApiOperation({ summary: 'Read bounded import/export metrics' })
  @ApiResponse({ status: 200, schema: metricsSchema })
  importExportMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.observability.importExportMetrics(
      dates.from,
      dates.to,
      dates.granularity,
    );
  }

  @Get('delivery-metrics')
  @RequirePermissions('system.observability.read')
  @ApiOperation({ summary: 'Read bounded webhook delivery metrics' })
  @ApiResponse({ status: 200, schema: metricsSchema })
  deliveryMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.metrics.webhookMetrics(dates.from, dates.to, dates.granularity);
  }

  @Get('error-tracking')
  @RequirePermissions('system.observability.read')
  @ApiOperation({
    summary: 'Read aggregated and redacted application/integration errors',
  })
  @ApiResponse({ status: 200, schema: metricsSchema })
  errorTracking(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.metrics.errorTracking(dates.from, dates.to);
  }

  @Get('audit-correlation')
  @RequirePermissions('system.observability.read')
  @ApiOperation({
    summary: 'Read request/service/job/integration audit correlation',
  })
  @ApiResponse({ status: 200, schema: metricsSchema })
  auditCorrelation(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.metrics.auditCorrelation(dates.from, dates.to);
  }
}
