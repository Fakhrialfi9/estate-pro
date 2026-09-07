import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
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
import { SystemContentSafetyService } from '../application/services/system-content-safety.service.js';
import { SystemImportService } from '../application/services/system-import.service.js';
import { ImportDto, ImportQueryDto } from './dto/import.dto.js';

const importResultSchema = {
  type: 'object',
  required: ['uuid', 'state', 'totalRows', 'processedRows', 'failedRows', 'errors', 'preview'],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    state: {
      type: 'string',
      enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'RETRYABLE'],
    },
    totalRows: { type: 'integer', minimum: 0 },
    processedRows: { type: 'integer', minimum: 0 },
    failedRows: { type: 'integer', minimum: 0 },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['row', 'message'],
        properties: {
          row: { type: 'integer', minimum: 0 },
          field: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    preview: { type: 'boolean' },
  },
};

const importListResultSchema = {
  type: 'object',
  required: ['items', 'total', 'page', 'limit'],
  properties: {
    items: { type: 'array', items: importResultSchema },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
  },
};

const failedRowReportSchema = {
  type: 'object',
  required: ['importUuid', 'state', 'failedRows', 'errors', 'generatedAt'],
  properties: {
    importUuid: { type: 'string', format: 'uuid' },
    state: {
      type: 'string',
      enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'RETRYABLE'],
    },
    failedRows: { type: 'integer', minimum: 0 },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['row', 'message'],
        properties: {
          row: { type: 'integer', minimum: 0 },
          field: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    generatedAt: { type: 'string', format: 'date-time' },
  },
};

@ApiTags('System Import')
@ApiBearerAuth()
@Controller({ path: 'system/imports', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class ImportController {
  constructor(
    private readonly imports: SystemImportService,
    private readonly safety: SystemContentSafetyService,
  ) {}

  @Post()
  @HttpCode(202)
  @RequirePermissions('system.import.create')
  @ApiOperation({ summary: 'Create and process a bounded CSV/JSON import' })
  @ApiResponse({ status: 202, description: 'Import accepted and processed asynchronously.', schema: importResultSchema })
  create(@Req() request: Request, @Body() dto: ImportDto) {
    const format = dto.format ?? (dto.filename.toLowerCase().endsWith('.json') ? 'json' : 'csv');
    const buffer = Buffer.from(dto.contentBase64 ?? '', 'base64');
    this.safety.inspectImport(buffer, format);
    return this.imports.execute(actor(request), dto);
  }

  @Get()
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'List import jobs owned by the authenticated actor' })
  @ApiResponse({ status: 200, description: 'Import jobs returned.', schema: importListResultSchema })
  list(@Req() request: Request, @Query() query: ImportQueryDto) {
    return this.imports.list(actor(request), query.page, query.limit, query.state);
  }

  @Get(':uuid')
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'Get an import job' })
  @ApiResponse({ status: 200, description: 'Import job returned.', schema: importResultSchema })
  get(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.imports.get(actor(request), uuid);
  }

  @Get(':uuid/errors')
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'Download the safe failed-row report for an import' })
  @ApiResponse({ status: 200, description: 'Failed-row report returned as a JSON attachment.', content: { 'application/json': { schema: failedRowReportSchema } } })
  async errors(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string, @Res() response: Response) {
    const report = await this.imports.failedRowReport(actor(request), uuid);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Disposition', `attachment; filename="${uuid}-errors.json"`);
    response.status(200).json(report);
  }

  @Post(':uuid/retry')
  @RequirePermissions('system.import.retry')
  @ApiOperation({ summary: 'Retry an import job' })
  @ApiResponse({ status: 200, description: 'Import retry accepted.', schema: importResultSchema })
  retry(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.imports.retry(actor(request), uuid);
  }

  @Post(':uuid/cancel')
  @RequirePermissions('system.import.cancel')
  @ApiOperation({ summary: 'Cancel an import job' })
  @ApiResponse({ status: 200, description: 'Import job cancellation applied.', schema: importResultSchema })
  cancel(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.imports.cancel(actor(request), uuid);
  }
}

function actor(request: Request): string {
  const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
  if (!actorUuid) throw new UnauthorizedException('Authenticated actor missing');
  return actorUuid;
}
