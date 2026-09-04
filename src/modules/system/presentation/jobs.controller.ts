import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { SystemJobOperationsService } from '../application/services/system-job-operations.service.js';
import { JobQueryDto } from './dto/job-query.dto.js';

const systemJobExecutionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    uuid: { type: 'string', format: 'uuid' },
    workflowUuid: { type: 'string', format: 'uuid' },
    workflowVersionUuid: { type: 'string', format: 'uuid' },
    eventId: { type: 'string', format: 'uuid' },
    eventType: { type: 'string' },
    entityType: { type: 'string' },
    entityUuid: { type: 'string', format: 'uuid' },
    state: {
      type: 'string',
      enum: [
        'PENDING',
        'RUNNING',
        'WAITING',
        'FAILED',
        'DEAD_LETTER',
        'CANCELLED',
        'COMPLETED',
      ],
    },
    currentNodeId: { type: 'string', nullable: true },
    contextSnapshot: { type: 'object', additionalProperties: true },
    chainDepth: { type: 'integer', minimum: 0 },
    visitedWorkflowUuids: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
    attemptCount: { type: 'integer', minimum: 0 },
    maxAttempts: { type: 'integer', minimum: 1 },
    retryAt: { type: 'string', format: 'date-time', nullable: true },
    leaseUntil: { type: 'string', format: 'date-time', nullable: true },
    claimedBy: { type: 'string', nullable: true },
    startedAt: { type: 'string', format: 'date-time', nullable: true },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    lastErrorCode: { type: 'string', nullable: true },
    lastErrorMessage: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    actions: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    version: { type: 'object', additionalProperties: true },
  },
  required: [
    'id',
    'uuid',
    'workflowUuid',
    'workflowVersionUuid',
    'eventId',
    'eventType',
    'entityType',
    'entityUuid',
    'state',
    'currentNodeId',
    'contextSnapshot',
    'chainDepth',
    'visitedWorkflowUuids',
    'attemptCount',
    'maxAttempts',
    'retryAt',
    'leaseUntil',
    'claimedBy',
    'startedAt',
    'completedAt',
    'lastErrorCode',
    'lastErrorMessage',
    'createdAt',
    'updatedAt',
  ],
};

const systemJobListResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: systemJobExecutionSchema,
    },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
  required: ['items', 'total', 'page', 'limit'],
};

@ApiTags('System Jobs')
@ApiBearerAuth()
@Controller({ path: 'system/jobs', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class JobsController {
  constructor(private readonly jobs: SystemJobOperationsService) {}

  @Get()
  @RequirePermissions('system.jobs.read')
  @ApiOperation({ summary: 'List operational workflow jobs' })
  @ApiResponse({
    status: 200,
    description: 'Operational workflow jobs returned.',
    schema: systemJobListResponseSchema,
  })
  list(@Req() request: Request, @Query() query: JobQueryDto) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.jobs.list(query, actorUuid);
  }

  @Get(':uuid')
  @RequirePermissions('system.jobs.read')
  @ApiOperation({ summary: 'Get an operational workflow job' })
  @ApiResponse({
    status: 200,
    description: 'Operational workflow job returned.',
    schema: systemJobExecutionSchema,
  })
  get(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.jobs.get(
      uuid,
      (request.user as { sub?: string } | undefined)?.sub ?? '',
    );
  }

  @Post(':uuid/retry')
  @RequirePermissions('system.jobs.retry')
  @ApiOperation({ summary: 'Retry an operational workflow job' })
  @ApiResponse({
    status: 200,
    description: 'Operational workflow job queued for retry.',
    schema: systemJobExecutionSchema,
  })
  retry(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.jobs.retry(
      uuid,
      (request.user as { sub?: string } | undefined)?.sub ?? '',
    );
  }

  @Post(':uuid/cancel')
  @RequirePermissions('system.jobs.cancel')
  @ApiOperation({ summary: 'Cancel an operational workflow job' })
  @ApiResponse({
    status: 200,
    description: 'Operational workflow job cancelled.',
    schema: systemJobExecutionSchema,
  })
  cancel(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.jobs.cancel(
      uuid,
      (request.user as { sub?: string } | undefined)?.sub ?? '',
    );
  }
}
