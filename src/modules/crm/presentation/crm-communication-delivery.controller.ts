import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { CrmCommunicationDeliveryService } from '../application/services/crm-communication-delivery.service.js';

@ApiTags('CRM Communications')
@ApiBearerAuth()
@Controller({ path: 'crm/communications', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class CrmCommunicationDeliveryController {
  constructor(private readonly delivery: CrmCommunicationDeliveryService) {}

  @Post(':uuid/send')
  @RequirePermissions('crm.communications.send')
  @ApiOperation({ summary: 'Deliver a queued CRM communication' })
  send(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new UnauthorizedException('Authenticated actor missing');
    return this.delivery.deliver(uuid, actorUuid);
  }
}
