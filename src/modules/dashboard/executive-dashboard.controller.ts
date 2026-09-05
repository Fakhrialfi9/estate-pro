import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../common/security/authorization.decorators.js';
import { ExecutiveDashboardQueryDto } from './executive-dashboard.query.dto.js';
import { ExecutiveDashboardService } from './executive-dashboard.service.js';

@ApiTags('Executive Dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class ExecutiveDashboardController {
  constructor(private readonly dashboard: ExecutiveDashboardService) {}

  @Get('executive')
  @RequirePermissions('system.dashboard.read')
  @ApiOperation({ summary: 'Read the authorized executive dashboard' })
  get(@Req() request: Request, @Query() query: ExecutiveDashboardQueryDto) {
    const user = request.user;
    if (!user?.sub) throw new Error('Authenticated actor missing');
    return this.dashboard.get(query, user);
  }
}
