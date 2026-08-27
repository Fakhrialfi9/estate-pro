import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyLifecycleService } from '../application/property-lifecycle.service.js';
import { PropertyLifecycleDto } from './property-master.dto.js';

type AuthenticatedRequest = Request & { user?: { sub?: string } };

const actor = (
  request: AuthenticatedRequest,
  userAgent?: string,
  requestId?: string,
) => ({
  actorUuid: request.user?.sub,
  ipAddress: request.ip,
  userAgent,
  requestId,
});

@ApiTags('Property Lifecycle')
@ApiBearerAuth()
@Controller({ path: 'property/properties', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyLifecycleController {
  constructor(private readonly service: PropertyLifecycleService) {}

  @Post(':uuid/verify')
  @RequirePermissions('properties.verify')
  @ApiOperation({ summary: 'Verify a property currently in review' })
  verify(
    @Req() request: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() body: PropertyLifecycleDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.verify(uuid, body.version, actor(request, userAgent, requestId));
  }

  @Post(':uuid/publish')
  @RequirePermissions('properties.publish')
  @ApiOperation({ summary: 'Publish a verified property' })
  publish(
    @Req() request: AuthenticatedRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() body: PropertyLifecycleDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.publish(uuid, body.version, actor(request, userAgent, requestId));
  }
}
