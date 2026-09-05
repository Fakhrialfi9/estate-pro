import {
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SystemIntegrationCallbackService } from '../application/services/system-integration-callback.service.js';
import { SystemIntegrationService } from '../application/services/system-integration.service.js';

@ApiTags('System Integration Callbacks')
@Controller({ path: 'system/integrations', version: '1' })
export class IntegrationCallbackController {
  constructor(
    private readonly callbacks: SystemIntegrationCallbackService,
    private readonly integrations: SystemIntegrationService,
  ) {}

  @Post(':uuid/callback')
  @ApiOperation({ summary: 'Receive an authenticated integration callback' })
  async callback(
    @Param('uuid') uuid: string,
    @Headers('x-integration-timestamp') timestamp: string,
    @Headers('x-integration-signature') signature: string,
    @Headers('x-integration-event-id') eventId: string | undefined,
    @Headers('x-integration-event-name') eventName: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    if (!timestamp || !signature)
      throw new UnauthorizedException('Callback authentication required');
    const provider = await this.integrations.providerFor(uuid);
    const body =
      request.rawBody?.toString('utf8') ?? JSON.stringify(request.body ?? {});
    return this.callbacks.handle(
      uuid,
      { timestamp, signature, eventId, eventName, body },
      provider,
    );
  }
}
