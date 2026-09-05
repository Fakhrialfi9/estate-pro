import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
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
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Headers('content-type') contentType: string | undefined,
    @Headers('x-integration-timestamp') timestamp: string,
    @Headers('x-integration-signature') signature: string,
    @Headers('x-integration-event-id') eventId: string | undefined,
    @Headers('x-integration-event-name') eventName: string | undefined,
    @Headers('x-integration-key-version') keyVersion: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    if (contentType?.toLowerCase().split(';')[0].trim() !== 'application/json')
      throw new BadRequestException(
        'Callback Content-Type must be application/json',
      );
    if (!timestamp || !signature)
      throw new UnauthorizedException('Callback authentication required');
    if (!request.rawBody)
      throw new BadRequestException('Raw callback body is required');
    const provider = await this.integrations.providerFor(uuid);
    return this.callbacks.handle(
      uuid,
      {
        timestamp,
        signature,
        eventId,
        eventName,
        keyVersion,
        body: request.rawBody.toString('utf8'),
      },
      provider,
    );
  }
}
