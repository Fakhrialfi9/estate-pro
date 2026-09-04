import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemOperationsService } from '../application/services/system-operations.service.js';

class ToggleOperationDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('System Operations')
@ApiBearerAuth()
@Controller({ path: 'system/operations', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class OperationsController {
  constructor(private readonly operations: SystemOperationsService) {}

  @Get()
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read system operational state' })
  state() {
    return this.operations.state();
  }

  @Get('diagnostics')
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read safe aggregated system diagnostics' })
  diagnostics() {
    return this.operations.diagnostics();
  }

  @Patch('maintenance')
  @RequirePermissions('system.operations.update')
  @ApiOperation({ summary: 'Toggle system maintenance mode' })
  maintenance(@Req() request: Request, @Body() dto: ToggleOperationDto) {
    return this.operations.setMaintenance(
      this.actor(request),
      dto.enabled === true,
    );
  }

  @Patch('read-only')
  @RequirePermissions('system.operations.update')
  @ApiOperation({ summary: 'Toggle system read-only mode' })
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
