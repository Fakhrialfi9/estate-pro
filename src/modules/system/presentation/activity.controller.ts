import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemActivityService } from '../application/services/system-activity.service.js';
import { ActivityQueryDto } from './dto/activity-query.dto.js';

@ApiTags('System Activity')
@ApiBearerAuth()
@Controller({ path: 'system/activity', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ActivityController {
  constructor(private readonly activity: SystemActivityService) {}

  @Get()
  @RequirePermissions('system.activity.read')
  @ApiOperation({ summary: 'Query system activity' })
  async list(@Query() query: ActivityQueryDto) {
    const result = await this.activity.list(query);
    return {
      items: result.items,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  @Get(':uuid')
  @RequirePermissions('system.activity.read')
  @ApiOperation({ summary: 'Get a single system activity entry' })
  @ApiResponse({ status: 200, description: 'System activity returned.' })
  get(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.activity.get(uuid);
  }
}
