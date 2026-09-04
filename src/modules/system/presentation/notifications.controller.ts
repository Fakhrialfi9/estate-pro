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

@ApiTags('System Notifications')
@ApiBearerAuth()
@Controller({ path: 'system/notifications', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class NotificationsController {
  constructor(private readonly notifications: SystemNotificationService) {}

  @Get()
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'List current-user notifications' })
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
  markAllRead(@Req() request: Request) {
    const userUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.markAllRead(userUuid);
  }

  @Patch(':uuid/read')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'Mark a current-user notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
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
  preferences(@Req() request: Request) {
    const userUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.notifications.preferences(userUuid);
  }

  @Patch('preferences')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'Update a current-user notification preference' })
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
  templates() {
    return this.notifications.templates({ activeOnly: false });
  }

  @Post('templates')
  @RequirePermissions('system.settings.update')
  @ApiOperation({ summary: 'Create a versioned notification template' })
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
  updateTemplate(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: NotificationTemplateUpdateDto,
  ) {
    return this.notifications.updateTemplate(uuid, dto);
  }

  @Get(':uuid/policy')
  @RequirePermissions('system.notifications.read')
  @ApiOperation({ summary: 'Get notification delivery policy' })
  policy(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.notifications.policy(uuid);
  }

  @Patch(':uuid/policy')
  @RequirePermissions('system.settings.update')
  @ApiOperation({
    summary: 'Update notification priority and expiration policy',
  })
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
  deliveries(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.notifications.deliveries(uuid);
  }

  @Post(':uuid/deliveries')
  @RequirePermissions('system.settings.update')
  @ApiOperation({ summary: 'Queue a notification delivery' })
  createDelivery(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: NotificationDeliveryDto,
  ) {
    return this.notifications.createDelivery(
      uuid,
      dto.channel,
      dto.maxAttempts,
    );
  }
}
