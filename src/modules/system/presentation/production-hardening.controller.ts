import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemProductionHardeningService } from '../application/services/system-production-hardening.service.js';
import { ObservabilityQueryDto } from './dto/observability-query.dto.js';

@ApiTags('System Production Hardening')
@ApiBearerAuth()
@Controller({ path: 'system', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class ProductionHardeningController {
  constructor(private readonly hardening: SystemProductionHardeningService) {}

  @Get('integrations/metrics')
  @RequirePermissions('system.integration.read')
  @ApiOperation({ summary: 'Read bounded integration reliability metrics' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  integrationMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.hardening.integrationMetrics({
      from: dates.from,
      to: dates.to,
      granularity: dates.granularity,
    });
  }

  @Get('jobs/metrics')
  @RequirePermissions('system.jobs.read')
  @ApiOperation({ summary: 'Read bounded background job metrics' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  jobMetrics(@Query() query: ObservabilityQueryDto) {
    const dates = query.toDates();
    return this.hardening.jobMetrics({
      from: dates.from,
      to: dates.to,
      granularity: dates.granularity,
    });
  }

  @Get('health/integration')
  @RequirePermissions('system.integration.read')
  @ApiOperation({
    summary: 'Read normalized health for registered integrations',
  })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  integrationHealth() {
    return this.hardening.integrationHealth();
  }

  @Get('health/external-dependency')
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read normalized external dependency health' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  externalDependencyHealth() {
    return this.hardening.externalDependencyHealth();
  }

  @Get('operations/commands')
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'List safe operational commands' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  commands() {
    return this.hardening.operationalCommands();
  }

  @Post('operations/retry-failed')
  @RequirePermissions('system.operations.retry')
  @ApiOperation({
    summary: 'Retry failed integration operations with dry-run by default',
  })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  retryFailed(
    @Req() request: Request,
    @Body() body: { dryRun?: boolean; limit?: number },
  ) {
    return this.hardening.retryFailedOperations(
      { dryRun: body?.dryRun !== false, limit: body?.limit },
      this.actor(request),
    );
  }

  @Post('operations/orphan-cleanup')
  @RequirePermissions('system.operations.cleanup')
  @ApiOperation({
    summary:
      'Inspect or clean explicitly eligible orphaned integration operations',
  })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  orphanCleanup(
    @Req() request: Request,
    @Body() body: { dryRun?: boolean; olderThanHours?: number },
  ) {
    return this.hardening.orphanCleanup(
      { dryRun: body?.dryRun !== false, olderThanHours: body?.olderThanHours },
      this.actor(request),
    );
  }

  private actor(request: Request) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return actorUuid;
  }
}
