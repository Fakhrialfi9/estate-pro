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
  constructor(private readonly observability: SystemObservabilityService) {}

  @Get('import-export-metrics')
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read bounded import/export metrics' })
  @ApiResponse({ status: 200, schema: metricsSchema })
  importExportMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.observability.importExportMetrics(dates.from, dates.to);
  }

  @Get('delivery-metrics')
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read bounded webhook delivery metrics' })
  @ApiResponse({ status: 200, schema: metricsSchema })
  deliveryMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.observability.deliveryMetrics(
      dates.from,
      dates.to,
      dates.subscriptionUuid,
    );
  }
}
