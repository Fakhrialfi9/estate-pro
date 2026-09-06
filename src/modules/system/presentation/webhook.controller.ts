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
import { SystemWebhookService } from '../application/services/system-webhook.service.js';
import {
  CreateWebhookDto,
  DeliveryListQueryDto,
  UpdateWebhookDto,
  WebhookListQueryDto,
} from './dto/webhook.dto.js';

const webhookEventSchema = {
  type: 'object',
  required: ['name', 'version'],
  properties: {
    name: { type: 'string' },
    version: { type: 'integer', minimum: 1 },
  },
};

const webhookFilterSchema = {
  type: 'object',
  required: ['field', 'operator'],
  properties: {
    field: { type: 'string' },
    operator: { type: 'string' },
    value: {},
  },
};

const webhookSchema = {
  type: 'object',
  required: [
    'uuid',
    'endpoint',
    'status',
    'events',
    'filters',
    'secretVersion',
    'secretCreatedAt',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    endpoint: { type: 'string', format: 'uri' },
    status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] },
    events: { type: 'array', items: { type: 'string' } },
    filters: { type: 'array', items: webhookFilterSchema },
    secretVersion: { type: 'integer', minimum: 1 },
    secretCreatedAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const webhookWithSecretSchema = {
  type: 'object',
  required: [...webhookSchema.required, 'secret'],
  properties: {
    ...webhookSchema.properties,
    secret: { type: 'string' },
  },
};

const webhookSecretRotationSchema = {
  type: 'object',
  required: ['uuid', 'secretVersion', 'secret'],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    secretVersion: { type: 'integer', minimum: 1 },
    secret: { type: 'string' },
  },
};

const webhookDeliverySchema = {
  type: 'object',
  required: [
    'uuid',
    'subscriptionId',
    'eventId',
    'deliveryKey',
    'eventName',
    'eventVersion',
    'payloadHash',
    'attemptCount',
    'state',
    'httpStatus',
    'responseSummary',
    'nextAttemptAt',
    'signedAt',
    'completedAt',
    'failureReason',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    subscriptionId: { type: 'string', description: 'Internal subscription identifier.' },
    eventId: { type: 'string' },
    deliveryKey: { type: 'string' },
    eventName: { type: 'string' },
    eventVersion: { type: 'integer', minimum: 1 },
    payloadHash: { type: 'string' },
    attemptCount: { type: 'integer', minimum: 0 },
    state: {
      type: 'string',
      enum: ['PENDING', 'DELIVERING', 'SUCCEEDED', 'RETRYING', 'DEAD_LETTER', 'CANCELLED'],
    },
    httpStatus: { type: 'integer', nullable: true },
    responseSummary: { type: 'string', nullable: true },
    nextAttemptAt: { type: 'string', format: 'date-time', nullable: true },
    signedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    failureReason: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const webhookDeliveryListSchema = {
  type: 'object',
  required: ['items', 'total', 'page', 'limit'],
  properties: {
    items: { type: 'array', items: webhookDeliverySchema },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
  },
};

const webhookListSchema = {
  type: 'object',
  required: ['items', 'total', 'page', 'limit'],
  properties: {
    items: { type: 'array', items: webhookSchema },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
  },
};

const webhookHealthSchema = {
  type: 'object',
  required: ['windowHours', 'deliveries', 'averageLatencyMs'],
  properties: {
    windowHours: { type: 'integer', minimum: 1 },
    deliveries: {
      type: 'object',
      required: ['total', 'successful', 'failed', 'retried'],
      properties: {
        total: { type: 'integer', minimum: 0 },
        successful: { type: 'integer', minimum: 0 },
        failed: { type: 'integer', minimum: 0 },
        retried: { type: 'integer', minimum: 0 },
      },
    },
    averageLatencyMs: { type: 'integer', minimum: 0 },
  },
};

const emptyDataSchema = {
  type: 'object',
  required: ['data'],
  properties: {
    data: { nullable: true },
  },
};

@ApiTags('System Webhooks')
@ApiBearerAuth()
@Controller({ path: 'system/webhooks', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class WebhookController {
  constructor(private readonly webhooks: SystemWebhookService) {}

  @Get('events')
  @RequirePermissions('system.webhook.read')
  @ApiOperation({ summary: 'List the supported webhook event catalog' })
  @ApiResponse({
    status: 200,
    description: 'Supported webhook event catalog.',
    schema: { type: 'array', items: webhookEventSchema },
  })
  events() {
    return { data: this.webhooks.eventCatalog() };
  }

  @Get()
  @RequirePermissions('system.webhook.read')
  @ApiOperation({ summary: 'List webhook subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Webhook subscriptions.',
    schema: webhookListSchema,
  })
  list(@Query() query: WebhookListQueryDto) {
    return this.webhooks.list(query.page, query.limit, query.status);
  }

  @Post()
  @RequirePermissions('system.webhook.create')
  @ApiOperation({ summary: 'Create an outbound webhook subscription' })
  @ApiResponse({
    status: 201,
    description: 'Webhook subscription created with its initial secret.',
    schema: { ...webhookWithSecretSchema },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Webhook subscription.',
    schema: webhookSchema,
  })
  get(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.webhooks.get(uuid);
  }

  @Get(':uuid/health')
  @RequirePermissions('system.webhook.read')
  @ApiOperation({ summary: 'Get safe recent webhook delivery health' })
  @ApiResponse({
    status: 200,
    description: 'Webhook delivery health for the last 24 hours.',
    schema: webhookHealthSchema,
  })
  health(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.webhooks.health(uuid);
  }

  @Patch(':uuid')
  @RequirePermissions('system.webhook.update')
  @ApiOperation({ summary: 'Update or enable/disable a webhook' })
  @ApiResponse({
    status: 200,
    description: 'Updated webhook subscription.',
    schema: webhookSchema,
  })
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
  @ApiResponse({
    status: 200,
    description: 'Webhook subscription deleted.',
    schema: emptyDataSchema,
  })
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
  @ApiResponse({
    status: 201,
    description: 'Webhook signing secret rotated.',
    schema: webhookSecretRotationSchema,
  })
  rotate(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.webhooks.rotateSecret(this.actor(request), uuid);
  }

  @Post(':uuid/test')
  @RequirePermissions('system.webhook.test')
  @ApiOperation({ summary: 'Send a signed test webhook delivery' })
  @ApiResponse({
    status: 201,
    description: 'Signed test webhook delivery result.',
    schema: webhookDeliverySchema,
  })
  test(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.webhooks.test(this.actor(request), uuid);
  }

  @Get(':uuid/deliveries')
  @RequirePermissions('system.webhook.read')
  @ApiOperation({ summary: 'List webhook delivery records' })
  @ApiResponse({
    status: 200,
    description: 'Webhook delivery records.',
    schema: webhookDeliveryListSchema,
  })
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
  @ApiResponse({
    status: 201,
    description: 'Webhook delivery replay result.',
    schema: webhookDeliverySchema,
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
