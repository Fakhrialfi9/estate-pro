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
import { SystemIntegrationLogService } from '../application/services/system-integration-log.service.js';

@ApiTags('System Integration Logs')
@ApiBearerAuth()
@Controller({ path: 'observability', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class IntegrationLogsController {
  constructor(private readonly logs: SystemIntegrationLogService) {}

  @Get('integration-logs')
  @RequirePermissions('system.integration.read')
  @ApiOperation({
    summary: 'List bounded, redacted integration lifecycle logs',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
  })
  list(
    @Query('integrationUuid') integrationUuid?: string,
    @Query('state') state?: string,
    @Query('operationKey') operationKey?: string,
    @Query('limit') limit?: string,
  ) {
    return this.logs.list({
      integrationUuid,
      state,
      operationKey,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
