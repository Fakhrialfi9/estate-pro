import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemWebhookService } from '../application/services/system-webhook.service.js';
import {
  CreateWebhookDto,
  DeliveryListQueryDto,
  UpdateWebhookDto,
  WebhookListQueryDto,
} from './dto/webhook.dto.js';

@ApiTags('System Webhooks')
@ApiBearerAuth()
@Controller({ path: 'system/webhooks', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class WebhookController {
  constructor(private readonly webhooks: SystemWebhookService) {}

  @Get('events')
  @RequirePermissions('system.webhook.read')
  @ApiOperation({ summary: 'List the supported webhook event catalog' })
  events() {
    return { data: this.webhooks.eventCatalog() };
  }

  @Get()
  @RequirePermissions('system.webhook.read')
  @ApiOperation({ summary: 'List webhook subscriptions' })
  list(@Query() query: WebhookListQueryDto) {
    return this.webhooks.list(query.page, query.limit, query.status);
  }

  @Post()
  @RequirePermissions('system.webhook.create')
  @ApiOperation({ summary: 'Create an outbound webhook subscription' })
  create(@Req() request: Request, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(
      this.actor(request),
      dto.endpoint,
      dto.events,
      dto.filters,
    );
  }

  @Get(':uuid')
  @RequirePermissions('system.webhook.read')
  @ApiOperation({ summary: 'Get a webhook subscription without its secret' })
  get(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.webhooks.get(uuid);
  }

  @Patch(':uuid')
  @RequirePermissions('system.webhook.update')
  @ApiOperation({ summary: 'Update or enable/disable a webhook' })
  update(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(this.actor(request), uuid, dto);
  }

  @Delete(':uuid')
  @RequirePermissions('system.webhook.delete')
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  async remove(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    await this.webhooks.remove(this.actor(request), uuid);
    return { data: null };
  }

  @Post(':uuid/rotate-secret')
  @RequirePermissions('system.webhook.rotate')
  @ApiOperation({ summary: 'Rotate webhook signing secret' })
  rotate(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.webhooks.rotateSecret(this.actor(request), uuid);
  }

  @Post(':uuid/test')
  @RequirePermissions('system.webhook.test')
  @ApiOperation({ summary: 'Send a signed test webhook delivery' })
  test(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.webhooks.test(this.actor(request), uuid);
  }

  @Get(':uuid/deliveries')
  @RequirePermissions('system.webhook.read')
  @ApiOperation({ summary: 'List webhook delivery records' })
  deliveries(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Query() query: DeliveryListQueryDto,
  ) {
    return this.webhooks.listDeliveries(
      uuid,
      query.page,
      query.limit,
      query.state,
    );
  }

  @Post('deliveries/:deliveryUuid/replay')
  @RequirePermissions('system.webhook.replay')
  @ApiOperation({
    summary: 'Replay a webhook delivery with a fresh delivery identity',
  })
  replay(
    @Req() request: Request,
    @Param('deliveryUuid', ParseUUIDPipe) deliveryUuid: string,
  ) {
    return this.webhooks.replay(this.actor(request), deliveryUuid);
  }

  private actor(request: Request): string {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return actorUuid;
  }
}
