import {
  Body,
  Controller,
  Get,
  Param,
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
import { SystemSettingsService } from '../application/services/system-settings.service.js';
import { SettingsQueryDto, UpdateSettingDto } from './dto/settings.dto.js';

@ApiTags('System Settings')
@ApiBearerAuth()
@Controller({ path: 'system/settings', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class SettingsController {
  constructor(private readonly settings: SystemSettingsService) {}

  @Get()
  @RequirePermissions('system.settings.read')
  @ApiOperation({ summary: 'List system settings' })
  list(@Query() query: SettingsQueryDto) {
    return this.settings.list(query.page, query.limit);
  }

  @Get(':key')
  @RequirePermissions('system.settings.read')
  @ApiOperation({ summary: 'Read a system setting' })
  get(@Param('key') key: string) {
    return this.settings.get(key);
  }

  @Patch(':key')
  @RequirePermissions('system.settings.update')
  @ApiOperation({ summary: 'Update a mutable system setting' })
  @ApiResponse({ status: 400, description: 'Invalid setting value.' })
  update(
    @Req() request: Request,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return this.settings.update(key, dto.value, actorUuid, dto.expectedVersion);
  }
}
