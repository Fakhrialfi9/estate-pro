import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { AgentManagementService } from '../application/agent-management.service.js';
import {
  AgentCreateDto,
  AgentStatusDto,
  AgentUpdateDto,
  AssignmentCreateDto,
  AvailabilityUpdateDto,
  CoverageCreateDto,
  ReassignmentDto,
  SpecializationCreateDto,
  TargetCreateDto,
  TargetUpdateDto,
} from '../application/agent-management.request.js';

type AuthRequest = Request & { user?: { sub?: string } };
const actor = (r: AuthRequest, userAgent?: string, requestId?: string) => ({
  uuid: r.user?.sub ?? '',
  ipAddress: r.ip,
  userAgent,
  requestId,
});

@ApiTags('Agent Management')
@ApiBearerAuth('bearer')
@Controller({ path: 'agents', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class AgentManagementController {
  constructor(private readonly service: AgentManagementService) {}

  @Get()
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'List agents' })
  @ApiResponse({ status: 200, description: 'Cursor-paginated agent directory' })
  list(
    @Req() r: AuthRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status', new ParseEnumPipe(AgentStatusDto)) status?: AgentStatusDto,
    @Query('specializationUuid') specializationUuid?: string,
    @Query('regionUuid') regionUuid?: string,
  ) {
    return this.service.list(
      {
        limit: limit ? Number(limit) : undefined,
        cursor,
        status,
        specializationUuid,
        regionUuid,
      },
      actor(r),
    );
  }
