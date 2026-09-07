import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
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
import { SystemRetentionService } from '../application/services/system-retention.service.js';
import { RetentionHoldDto } from './dto/retention-hold.dto.js';

const retentionHoldResponseSchema = {
  type: 'object',
  required: ['held', 'holdUntil'],
  properties: {
    held: { type: 'boolean' },
    holdUntil: { type: 'string', format: 'date-time', nullable: true },
  },
};

@ApiTags('System Retention')
@ApiBearerAuth()
@Controller({ path: 'system/retention', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
@RequirePermissions('system.settings.update')
export class RetentionController {
  constructor(private readonly retention: SystemRetentionService) {}

  @Patch('activity/:uuid/hold')
  @ApiOperation({ summary: 'Set or release an activity retention hold' })
  @ApiResponse({
    status: 200,
    description: 'Activity retention hold updated.',
    schema: retentionHoldResponseSchema,
  })
  setActivityHold(
    @Req() request: Request,
    @Param('uuid') uuid: string,
    @Body() dto: RetentionHoldDto,
  ) {
    return this.retention.setActivityHold(
      this.actor(request),
      uuid,
      dto.enabled,
      dto.toDate(),
    );
  }

  @Patch('audit/:uuid/hold')
  @ApiOperation({ summary: 'Set or release an audit retention hold' })
  @ApiResponse({
    status: 200,
    description: 'Audit retention hold updated.',
    schema: retentionHoldResponseSchema,
  })
  setAuditHold(
    @Req() request: Request,
    @Param('uuid') uuid: string,
    @Body() dto: RetentionHoldDto,
  ) {
    return this.retention.setAuditHold(
      this.actor(request),
      uuid,
      dto.enabled,
      dto.toDate(),
    );
  }

  private actor(request: Request): string {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return actorUuid;
  }
}
