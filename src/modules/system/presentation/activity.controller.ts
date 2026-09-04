import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

const systemActivityItemSchema = {
  type: 'object',
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    actorUuid: { type: 'string', format: 'uuid', nullable: true },
    eventType: { type: 'string' },
    category: { type: 'string' },
    resourceType: { type: 'string', nullable: true },
    resourceUuid: { type: 'string', format: 'uuid', nullable: true },
    summary: { type: 'string' },
    metadata: { type: 'object', additionalProperties: true },
    requestId: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'uuid',
    'actorUuid',
    'eventType',
    'category',
    'resourceType',
    'resourceUuid',
    'summary',
    'metadata',
    'requestId',
    'createdAt',
  ],
};

const systemActivityListResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: systemActivityItemSchema,
    },
    meta: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1 },
        limit: { type: 'integer', minimum: 1 },
        total: { type: 'integer', minimum: 0 },
        totalPages: { type: 'integer', minimum: 0 },
      },
      required: ['page', 'limit', 'total', 'totalPages'],
    },
  },
  required: ['items', 'meta'],
};

@ApiTags('System Activity')
@ApiBearerAuth()
@Controller({ path: 'system/activity', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ActivityController {
  constructor(private readonly activity: SystemActivityService) {}

  @Get()
  @RequirePermissions('system.activity.read')
  @ApiOperation({ summary: 'Query system activity' })
  @ApiResponse({
    status: 200,
    description: 'System activity returned.',
    schema: systemActivityListResponseSchema,
  })
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
}
