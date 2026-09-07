import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemOperationsService } from '../application/services/system-operations.service.js';

const operationalStateSchema = {
  type: 'object',
  required: ['maintenanceMode', 'readOnlyMode', 'updatedAt'],
  properties: {
    maintenanceMode: { type: 'boolean' },
    readOnlyMode: { type: 'boolean' },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const diagnosticsSchema = {
  type: 'object',
  required: ['status', 'maintenanceMode', 'readOnlyMode', 'components'],
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    maintenanceMode: { type: 'boolean' },
    readOnlyMode: { type: 'boolean' },
    components: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        enum: ['up', 'down', 'unknown'],
      },
    },
  },
};

class ToggleOperationDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('System Operations')
@ApiBearerAuth()
@Controller({ path: 'system/operations', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class OperationsController {
  constructor(private readonly operations: SystemOperationsService) {}

  @Get()
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read system operational state' })
  @ApiResponse({ status: 200, schema: operationalStateSchema })
  state() {
    return this.operations.state();
  }

  @Get('diagnostics')
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read safe aggregated system diagnostics' })
  @ApiResponse({ status: 200, schema: diagnosticsSchema })
  diagnostics() {
    return this.operations.diagnostics();
  }

  @Patch('maintenance')
  @RequirePermissions('system.operations.update')
  @ApiOperation({ summary: 'Toggle system maintenance mode' })
  @ApiResponse({
    status: 200,
    description: 'System operational state returned after the update.',
    schema: operationalStateSchema,
  })
  maintenance(@Req() request: Request, @Body() dto: ToggleOperationDto) {
    return this.operations.setMaintenance(
      this.actor(request),
      dto.enabled === true,
    );
  }

  @Patch('read-only')
  @RequirePermissions('system.operations.update')
  @ApiOperation({ summary: 'Toggle system read-only mode' })
  @ApiResponse({
    status: 200,
    description: 'System operational state returned after the update.',
    schema: operationalStateSchema,
  })
  readOnly(@Req() request: Request, @Body() dto: ToggleOperationDto) {
    return this.operations.setReadOnly(
      this.actor(request),
      dto.enabled === true,
    );
  }

  private actor(request: Request): string {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return actorUuid;
  }
}
