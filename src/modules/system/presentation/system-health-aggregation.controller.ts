import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemProductionHardeningService } from '../application/services/system-production-hardening.service.js';

@ApiTags('System Health')
@ApiBearerAuth()
@Controller({ path: 'health', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class SystemHealthAggregationController {
  constructor(private readonly hardening: SystemProductionHardeningService) {}

  @Get('integration-health')
  @RequirePermissions('system.integration.health.read')
  @ApiOperation({ summary: 'Read normalized integration provider health' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  integrationHealth() {
    return this.hardening.integrationHealth();
  }

  @Get('external-dependency-health')
  @RequirePermissions('system.external.health.read')
  @ApiOperation({ summary: 'Read normalized external dependency health' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  externalDependencyHealth() {
    return this.hardening.externalDependencyHealth();
  }
}
