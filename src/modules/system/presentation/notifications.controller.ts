import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemNotificationService } from '../application/services/system-notification.service.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';
import {
  NotificationDeliveryDto,
  NotificationPolicyDto,
  NotificationPreferenceDto,
  NotificationTemplateDto,
  NotificationTemplateUpdateDto,
} from './dto/notification-management.dto.js';

const notificationSchema = {
  type: 'object',
  required: [
    'uuid',
    'userUuid',
    'type',
    'title',
    'body',
    'status',
    'createdAt',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    userUuid: { type: 'string', format: 'uuid' },
    type: { type: 'string' },
    title: { type: 'string' },
    body: { type: 'string' },
    entityType: { type: 'string', nullable: true },
    entityUuid: { type: 'string', format: 'uuid', nullable: true },
    status: { type: 'string' },
    readAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const notificationListSchema = {
  type: 'object',
  required: ['items', 'total', 'page', 'limit'],
  properties: {
    items: { type: 'array', items: notificationSchema },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
  },
};

const notificationPreferenceSchema = {
  type: 'object',
  required: [
    'uuid',
    'userUuid',
    'notificationType',
    'channel',
    'enabled',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    userUuid: { type: 'string', format: 'uuid' },
    notificationType: { type: 'string' },
    channel: {
      type: 'string',
      enum: ['IN_APP', 'EMAIL', 'WHATSAPP', 'SMS'],
    },
    enabled: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const notificationTemplateSchema = {
  type: 'object',
  required: [
    'uuid',
    'code',
    'version',
    'titleTemplate',
    'bodyTemplate',
    'variables',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    code: { type: 'string' },
    version: { type: 'integer', minimum: 1 },
    titleTemplate: { type: 'string' },
    bodyTemplate: { type: 'string' },
    variables: { type: 'array', items: { type: 'string' } },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const notificationPolicySchema = {
  type: 'object',
  required: ['uuid', 'notificationUuid', 'priority', 'createdAt', 'updatedAt'],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    notificationUuid: { type: 'string', format: 'uuid' },
    templateUuid: { type: 'string', format: 'uuid', nullable: true },
    priority: {
      type: 'string',
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const genericObjectSchema = {
  type: 'object',
  additionalProperties: true,
};

@ApiTags('System Notifications')
@ApiBearerAuth()
@Controller({ path: 'system/notifications', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class NotificationsController {
  constructor(private readonly notifications: SystemNotificationService) {}

  @Get()
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'List current-user notifications' })
  @ApiResponse({ status: 200, schema: notificationListSchema })
  list(@Req() request: Request, @Query() query: NotificationQueryDto) {
    const userUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.list(
      userUuid,
      query.page,
      query.limit,
      query.unreadOnly === true,
    );
  }

  @Patch('read-all')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'Mark all current-user notifications as read' })
  @ApiResponse({ status: 200, schema: { type: 'object', required: ['updated'], properties: { updated: { type: 'integer', minimum: 0 } } } })
  markAllRead(@Req() request: Request) {
    const userUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.markAllRead(userUuid);
  }

  @Patch(':uuid/read')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'Mark a current-user notification as read' })
  @ApiResponse({ status: 200, schema: notificationSchema })
  markRead(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    const userUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.markRead(userUuid, uuid);
  }

  @Get('preferences')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'List current-user notification preferences' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: notificationPreferenceSchema } })
  preferences(@Req() request: Request) {
    const userUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.preferences(userUuid);
  }

  @Patch('preferences')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'Update a current-user notification preference' })
  @ApiResponse({ status: 200, schema: notificationPreferenceSchema })
  setPreference(
    @Req() request: Request,
    @Body() dto: NotificationPreferenceDto,
  ) {
    const userUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.setPreference(userUuid, dto);
  }

  @Get('templates')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'List notification templates' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: notificationTemplateSchema } })
  templates() {
    return this.notifications.templates({ activeOnly: false });
  }

  @Post('templates')
  @RequirePermissions('system.settings.update')
  @ApiOperation({ summary: 'Create a versioned notification template' })
  @ApiResponse({ status: 201, schema: notificationTemplateSchema })
  createTemplate(
    @Req() request: Request,
    @Body() dto: NotificationTemplateDto,
  ) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.createTemplate({
      ...dto,
      variables: dto.variables ?? [],
      actorUuid,
    });
  }

  @Patch('templates/:uuid')
  @RequirePermissions('system.settings.update')
  @ApiOperation({ summary: 'Update a notification template' })
  @ApiResponse({ status: 200, schema: notificationTemplateSchema })
  updateTemplate(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: NotificationTemplateUpdateDto,
  ) {
    return this.notifications.updateTemplate(uuid, dto);
  }

  @Get(':uuid/policy')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'Get notification delivery policy' })
  @ApiResponse({ status: 200, schema: notificationPolicySchema })
  policy(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.notifications.policy(uuid);
  }

  @Patch(':uuid/policy')
  @RequirePermissions('system.settings.update')
  @ApiOperation({ summary: 'Update notification priority and expiration policy' })
  @ApiResponse({ status: 200, schema: notificationPolicySchema })
  setPolicy(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: NotificationPolicyDto,
  ) {
    return this.notifications.setPolicy(uuid, {
      ...dto,
      expiresAt:
        dto.expiresAt === undefined || dto.expiresAt === null
          ? dto.expiresAt
          : new Date(dto.expiresAt),
    });
  }

  @Get(':uuid/deliveries')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'List notification delivery states' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: genericObjectSchema } })
  deliveries(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.notifications.deliveries(uuid);
  }

  @Post(':uuid/deliveries')
  @RequirePermissions('system.settings.update')
  @ApiOperation({ summary: 'Queue a notification delivery' })
  @ApiResponse({ status: 201, schema: genericObjectSchema })
  createDelivery(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: NotificationDeliveryDto,
  ) {
    return this.notifications.createDelivery(uuid, dto.channel, dto.maxAttempts);
  }

  @Post('deliveries/:deliveryUuid/retry')
  @RequirePermissions('system.settings.update')
  @ApiOperation({ summary: 'Queue a failed notification delivery for retry' })
  @ApiResponse({ status: 200, schema: genericObjectSchema })
  retryDelivery(
    @Param('deliveryUuid', ParseUUIDPipe) deliveryUuid: string,
    @Req() request: Request,
  ) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.retryDelivery(deliveryUuid, actorUuid);
  }
}