import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../common/security/authorization.guard.js';
import {
  RequirePermissions,
  RequirePermissionsAny,
} from '../../common/security/authorization.decorators.js';
import { ExecutiveDashboardQueryDto } from './executive-dashboard.query.dto.js';
import { ExecutiveDashboardService } from './executive-dashboard.service.js';

@ApiTags('Executive Dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class ExecutiveDashboardController {
  constructor(private readonly dashboard: ExecutiveDashboardService) {}

  @Get('executive')
  @RequirePermissionsAny(
    'system.dashboard.read',
    'analytics.read',
    'analytics.read.all',
    'analytics.manage',
  )
  @ApiOperation({ summary: 'Read the authorized executive dashboard' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  get(@Req() request: Request, @Query() query: ExecutiveDashboardQueryDto) {
    return this.dashboard.get(query, actor(request));
  }

  @Get(['property', 'property-dashboard'])
  @RequirePermissionsAny(
    'system.dashboard.read',
    'analytics.read',
    'analytics.read.all',
    'analytics.manage',
  )
  @ApiOperation({ summary: 'Read property dashboard KPIs' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  property(
    @Req() request: Request,
    @Query() query: ExecutiveDashboardQueryDto,
  ) {
    return this.dashboard.getProperty(query, actor(request));
  }

  @Get(['crm', 'crm-dashboard'])
  @RequirePermissionsAny(
    'system.dashboard.read',
    'analytics.read',
    'analytics.read.all',
    'analytics.manage',
  )
  @ApiOperation({ summary: 'Read CRM dashboard KPIs' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  crm(@Req() request: Request, @Query() query: ExecutiveDashboardQueryDto) {
    return this.dashboard.getCrm(query, actor(request));
  }

  @Get(['sales', 'sales-dashboard'])
  @RequirePermissionsAny(
    'system.dashboard.read',
    'analytics.read',
    'analytics.read.all',
    'analytics.manage',
  )
  @ApiOperation({ summary: 'Read sales dashboard KPIs' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  sales(@Req() request: Request, @Query() query: ExecutiveDashboardQueryDto) {
    return this.dashboard.getSales(query, actor(request));
  }

  @Get(['agent', 'agent-dashboard'])
  @RequirePermissionsAny(
    'system.dashboard.read',
    'analytics.read',
    'analytics.read.all',
    'analytics.manage',
  )
  @ApiOperation({ summary: 'Read agent dashboard KPIs' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  agent(@Req() request: Request, @Query() query: ExecutiveDashboardQueryDto) {
    return this.dashboard.getAgent(query, actor(request));
  }

  @Get(['operational', 'operational-dashboard'])
  @RequirePermissions('system.dashboard.read')
  @ApiOperation({ summary: 'Read operational dashboard status' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', additionalProperties: true },
  })
  operational() {
    return this.dashboard.getOperational();
  }
}

function actor(request: Request) {
  const user = request.user;
  if (!user?.sub) throw new Error('Authenticated actor missing');
  return user;
}
