import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemExportService } from '../application/services/system-export.service.js';
import { ExportDto, ExportQueryDto } from './dto/export.dto.js';

const EXPORT_RESULT_SCHEMA = {
  type: 'object',
  required: ['uuid', 'state', 'format', 'rows', 'expiresAt'],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    state: {
      type: 'string',
      enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
    },
    format: { type: 'string', enum: ['csv', 'json', 'xlsx'] },
    rows: { type: 'integer', minimum: 0 },
    processedRows: { type: 'integer', minimum: 0 },
    estimatedRows: { type: 'integer', minimum: 0, nullable: true },
    expiresAt: { type: 'string', format: 'date-time' },
  },
};

const EXPORT_CREATE_RESULT_SCHEMA = {
  type: 'object',
  required: ['uuid', 'state', 'format', 'rows', 'expiresAt', 'downloadToken'],
  properties: {
    ...EXPORT_RESULT_SCHEMA.properties,
    downloadToken: { type: 'string', minLength: 1 },
  },
};

const EXPORT_JOB_SCHEMA = {
  type: 'object',
  required: [
    'uuid',
    'actorUuid',
    'entity',
    'format',
    'state',
    'filters',
    'rows',
    'processedRows',
    'estimatedRows',
    'expiresAt',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    actorUuid: { type: 'string', format: 'uuid' },
    entity: { type: 'string', enum: ['system_activity'] },
    format: { type: 'string', enum: ['csv', 'json', 'xlsx'] },
    state: {
      type: 'string',
      enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
    },
    filters: { type: 'object', additionalProperties: true },
    rows: { type: 'integer', minimum: 0 },
    processedRows: { type: 'integer', minimum: 0 },
    estimatedRows: { type: 'integer', minimum: 0, nullable: true },
    expiresAt: { type: 'string', format: 'date-time' },
    errorMessage: { type: 'string', nullable: true },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    cancelledAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const EXPORT_LIST_SCHEMA = {
  type: 'object',
  required: ['items', 'total', 'page', 'limit'],
  properties: {
    items: { type: 'array', items: EXPORT_JOB_SCHEMA },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
  },
};

@ApiTags('System Export')
@ApiBearerAuth()
@Controller({ path: 'system/exports', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class ExportController {
  constructor(private readonly exports: SystemExportService) {}

  @Post()
  @RequirePermissions('system.export.create')
  @ApiOperation({ summary: 'Create a bounded System export' })
  @ApiResponse({
    status: 201,
    description: 'Export artifact job created.',
    content: {
      'application/json': { schema: EXPORT_CREATE_RESULT_SCHEMA },
    },
  })
  create(@Req() request: Request, @Body() dto: ExportDto) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return this.exports.execute({
      ...dto,
      actorUuid,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
    });
  }

  @Get()
  @RequirePermissions('system.export.read')
  @ApiOperation({
    summary: 'List export jobs owned by the authenticated actor',
  })
  @ApiResponse({
    status: 200,
    description: 'Export jobs returned.',
    content: { 'application/json': { schema: EXPORT_LIST_SCHEMA } },
  })
  list(@Req() request: Request, @Query() query: ExportQueryDto) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.exports.list(actorUuid, query.page, query.limit, query.state);
  }

  @Get(':uuid')
  @RequirePermissions('system.export.read')
  @ApiOperation({ summary: 'Get an export job and its operational progress' })
  @ApiResponse({
    status: 200,
    description: 'Export job returned.',
    content: { 'application/json': { schema: EXPORT_JOB_SCHEMA } },
  })
  get(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.exports.get(actorUuid, uuid);
  }

  @Post(':uuid/retry')
  @RequirePermissions('system.export.retry')
  @ApiOperation({
    summary: 'Retry a failed export using its immutable request snapshot',
  })
  @ApiResponse({
    status: 201,
    description: 'Export retry queued.',
    content: { 'application/json': { schema: EXPORT_CREATE_RESULT_SCHEMA } },
  })
  retry(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.exports.retry(actorUuid, uuid);
  }

  @Post(':uuid/cancel')
  @RequirePermissions('system.export.cancel')
  @ApiOperation({ summary: 'Request cooperative export cancellation' })
  @ApiResponse({
    status: 201,
    description: 'Export cancellation requested.',
    content: { 'application/json': { schema: EXPORT_RESULT_SCHEMA } },
  })
  cancel(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.exports.cancel(actorUuid, uuid);
  }

  @Get(':uuid/download')
  @RequirePermissions('system.export.download')
  @ApiOperation({ summary: 'Download a short-lived export artifact' })
  @ApiResponse({
    status: 200,
    description: 'Export artifact stream returned.',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async download(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Query('token') token: string,
    @Res() response: Response,
  ) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    const result = await this.exports.download(actorUuid, uuid, token);
    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    result.stream.pipe(response);
  }
}
