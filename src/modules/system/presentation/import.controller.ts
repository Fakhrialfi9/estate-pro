import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemImportService } from '../application/services/system-import.service.js';
import { ImportDto, ImportQueryDto } from './dto/import.dto.js';

@ApiTags('System Import')
@ApiBearerAuth()
@Controller({ path: 'system/imports', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class ImportController {
  constructor(private readonly imports: SystemImportService) {}

  @Post()
  @HttpCode(202)
  @RequirePermissions('system.import.create')
  @ApiOperation({ summary: 'Create and process a bounded CSV/JSON import' })
  @ApiResponse({ status: 202, description: 'Import accepted.' })
  create(@Req() request: Request, @Body() dto: ImportDto) {
    return this.imports.execute(actor(request), dto);
  }

  @Get()
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'List import jobs owned by the authenticated actor' })
  list(@Req() request: Request, @Query() query: ImportQueryDto) {
    return this.imports.list(actor(request), query.page, query.limit, query.state);
  }

  @Get(':uuid')
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'Get an import job' })
  get(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.imports.get(actor(request), uuid);
  }

  @Get(':uuid/errors')
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'Download the safe failed-row report for an import' })
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
  retry(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.imports.retry(actor(request), uuid);
  }

  @Post(':uuid/cancel')
  @RequirePermissions('system.import.cancel')
  @ApiOperation({ summary: 'Cancel an import job' })
  cancel(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.imports.cancel(actor(request), uuid);
  }
}

function actor(request: Request): string {
  const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
  if (!actorUuid) throw new UnauthorizedException('Authenticated actor missing');
  return actorUuid;
}
