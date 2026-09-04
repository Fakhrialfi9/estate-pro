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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemImportService } from '../application/services/system-import.service.js';
import { ImportDto, ImportQueryDto } from './dto/import.dto.js';

@ApiTags('System Import')
@ApiBearerAuth()
@Controller({ path: 'system/imports', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ImportController {
  constructor(private readonly imports: SystemImportService) {}

  @Post()
  @HttpCode(202)
  @RequirePermissions('system.import.create')
  @ApiOperation({ summary: 'Create and process a bounded CSV/JSON import' })
  @ApiResponse({ status: 202, description: 'Import accepted.' })
  create(@Req() request: Request, @Body() dto: ImportDto) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return this.imports.execute(actorUuid, dto);
  }

  @Get()
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'List import jobs owned by the authenticated actor' })
  list(@Req() request: Request, @Query() query: ImportQueryDto) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.imports.list(
      actorUuid,
      query.page,
      query.limit,
      query.state as never,
    );
  }

  @Get(':uuid')
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'Get an import job' })
  get(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.imports.get(actorUuid, uuid);
  }

  @Get(':uuid/errors')
  @RequirePermissions('system.import.read')
  @ApiOperation({ summary: 'Download the safe failed-row report for an import' })
  async errors(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Res() response: Response,
  ) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    const report = await this.imports.failedRowReport(actorUuid, uuid);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${uuid}-errors.json"`,
    );
    response.status(200).json(report);
  }

  @Post(':uuid/retry')
  @RequirePermissions('system.import.retry')
  @ApiOperation({ summary: 'Retry an import job' })
  retry(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.imports.retry(actorUuid, uuid);
  }

  @Post(':uuid/cancel')
  @RequirePermissions('system.import.cancel')
  @ApiOperation({ summary: 'Cancel an import job' })
  cancel(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.imports.cancel(actorUuid, uuid);
  }
}
