import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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

const systemNotificationItemSchema = {
  type: 'object',
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
  required: [
    'uuid',
    'userUuid',
    'type',
    'title',
    'body',
    'entityType',
    'entityUuid',
    'status',
    'readAt',
    'createdAt',
  ],
};

const systemNotificationListResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: systemNotificationItemSchema,
    },
    total: { type: 'integer', minimum: 0 },
  },
  required: ['items', 'total'],
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
  @ApiResponse({
    status: 200,
    description: 'Current-user notifications returned.',
    schema: systemNotificationListResponseSchema,
  })
  list(@Req() request: Request, @Query() query: NotificationQueryDto) {
    return this.notifications.list(
      (request.user as { sub?: string } | undefined)?.sub ?? '',
      query.page,
      query.limit,
      query.unreadOnly === true,
    );
  }

  @Patch(':uuid/read')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'Mark a current-user notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read.',
    schema: systemNotificationItemSchema,
  })
  markRead(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    return this.notifications.markRead(
      (request.user as { sub?: string } | undefined)?.sub ?? '',
      uuid,
    );
  }
}
