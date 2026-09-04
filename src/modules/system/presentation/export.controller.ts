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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemExportService } from '../application/services/system-export.service.js';
import { ExportDto, ExportQueryDto } from './dto/export.dto.js';

@ApiTags('System Export')
@ApiBearerAuth()
@Controller({ path: 'system/exports', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ExportController {
  constructor(private readonly exports: SystemExportService) {}

  @Post()
  @RequirePermissions('system.export.create')
  @ApiOperation({ summary: 'Create a bounded System export' })
  @ApiResponse({ status: 201, description: 'Export artifact created.' })
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
  @ApiOperation({ summary: 'List export jobs owned by the authenticated actor' })
  list(@Req() request: Request, @Query() query: ExportQueryDto) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.exports.list(actorUuid, query.page, query.limit, query.state);
  }

  @Get(':uuid')
  @RequirePermissions('system.export.read')
  @ApiOperation({ summary: 'Get an export job and its operational progress' })
  get(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.exports.get(actorUuid, uuid);
  }

  @Post(':uuid/retry')
  @RequirePermissions('system.export.retry')
  @ApiOperation({ summary: 'Retry a failed export using its immutable request snapshot' })
  retry(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.exports.retry(actorUuid, uuid);
  }

  @Post(':uuid/cancel')
  @RequirePermissions('system.export.cancel')
  @ApiOperation({ summary: 'Request cooperative export cancellation' })
  cancel(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.exports.cancel(actorUuid, uuid);
  }

  @Get(':uuid/download')
  @RequirePermissions('system.export.download')
  @ApiOperation({ summary: 'Download a short-lived export artifact' })
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
