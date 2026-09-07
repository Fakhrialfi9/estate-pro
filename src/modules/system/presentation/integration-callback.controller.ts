import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SystemWebhookRateLimitService } from '../application/services/system-webhook-rate-limit.service.js';
import { SystemIntegrationCallbackService } from '../application/services/system-integration-callback.service.js';
import { SystemIntegrationService } from '../application/services/system-integration.service.js';

@ApiTags('System Integrations')
@Controller({ path: 'system/integrations', version: '1' })
export class IntegrationCallbackController {
  constructor(
    private readonly callbacks: SystemIntegrationCallbackService,
    private readonly integrations: SystemIntegrationService,
    private readonly webhookRateLimit: SystemWebhookRateLimitService,
  ) {}

  @Post(':uuid/callback')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive an authenticated integration callback' })
  @ApiResponse({
    status: 202,
    description: 'Integration callback durably queued for asynchronous processing.',
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  })
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
    const mediaType = (contentType?.split(';')[0] ?? '').trim().toLowerCase();
    if (mediaType !== 'application/json')
      throw new BadRequestException(
        'Callback Content-Type must be application/json',
      );
    if (!timestamp || !signature)
      throw new UnauthorizedException('Callback authentication required');
    if (!request.rawBody)
      throw new BadRequestException('Raw callback body is required');

    await this.webhookRateLimit.consume(uuid);
    const provider = await this.integrations.providerFor(uuid);
    return this.callbacks.enqueue(
      uuid,
      {
        timestamp,
        signature,
        body: request.rawBody.toString('utf8'),
        eventId,
        eventName,
        keyVersion,
      },
      provider,
    );
  }
}
