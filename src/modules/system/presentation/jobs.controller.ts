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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemJobOperationsService } from '../application/services/system-job-operations.service.js';
import { JobQueryDto } from './dto/job-query.dto.js';

@ApiTags('System Jobs')
@ApiBearerAuth()
@Controller({ path: 'system/jobs', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class JobsController {
  constructor(private readonly jobs: SystemJobOperationsService) {}

  @Get()
  @RequirePermissions('system.jobs.read')
  @ApiOperation({ summary: 'List operational workflow jobs' })
  list(@Req() request: Request, @Query() query: JobQueryDto) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub ?? '';
    return this.jobs.list(query, actorUuid);
  }

  @Get(':uuid')
  @RequirePermissions('system.jobs.read')
  get(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.jobs.get(
      uuid,
      (request.user as { sub?: string } | undefined)?.sub ?? '',
    );
  }

  @Post(':uuid/retry')
  @RequirePermissions('system.jobs.retry')
  retry(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.jobs.retry(
      uuid,
      (request.user as { sub?: string } | undefined)?.sub ?? '',
    );
  }

  @Post(':uuid/cancel')
  @RequirePermissions('system.jobs.cancel')
  cancel(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.jobs.cancel(
      uuid,
      (request.user as { sub?: string } | undefined)?.sub ?? '',
    );
  }
}
