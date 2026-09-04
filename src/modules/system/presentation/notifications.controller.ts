import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemNotificationService } from '../application/services/system-notification.service.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';
@ApiTags('System Notifications')
@ApiBearerAuth()
@Controller({path:'system/notifications',version:'1'})
@UseGuards(JwtAuthGuard,AuthorizationGuard)
export class NotificationsController {
 constructor(private readonly notifications:SystemNotificationService){}
 @Get() @RequirePermissions('system.notifications.read') @ApiOperation({summary:'List current-user notifications'})
 list(@Req() request:Request,@Query() query:NotificationQueryDto){return this.notifications.list((request.user as {sub?:string}|undefined)?.sub??'',query.page,query.limit,query.unreadOnly===true);}
 @Patch(':uuid/read') @RequirePermissions('system.notifications.read') @ApiOperation({summary:'Mark a current-user notification as read'})
 markRead(@Req() request:Request,@Param('uuid',ParseUUIDPipe) uuid:string){return this.notifications.markRead((request.user as {sub?:string}|undefined)?.sub??'',uuid);}
 @Patch('read-all') @RequirePermissions('system.notifications.read') @ApiOperation({summary:'Mark all current-user notifications as read'}) @ApiResponse({status:200,description:'Unread notifications marked as read.'})
 markAllRead(@Req() request:Request){return this.notifications.markAllRead((request.user as {sub?:string}|undefined)?.sub??'');}
}
