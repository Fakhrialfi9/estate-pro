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
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
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
} from '../application/agent-management.dto.js';

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
@UseGuards(JwtAuthGuard, AuthorizationGuard)
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

  @Post()
  @RequirePermissions('agents.manage')
  @ApiOperation({ summary: 'Create an agent profile' })
  create(
    @Req() r: AuthRequest,
    @Body() dto: AgentCreateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.create(dto, actor(r, ua, requestId));
  }

  @Get('specializations')
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'List active specialization taxonomy' })
  specializations() {
    return this.service.listSpecializations();
  }

  @Post('specializations')
  @RequirePermissions('agents.specialization.manage')
  createSpecialization(
    @Req() r: AuthRequest,
    @Body() dto: SpecializationCreateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.createSpecialization(dto, actor(r, ua, requestId));
  }

  @Get('candidates/search')
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'Find eligible assignment candidates' })
  candidates(
    @Req() r: AuthRequest,
    @Query('propertyUuid') propertyUuid?: string,
    @Query('specializationUuid') specializationUuid?: string,
    @Query('regionUuid') regionUuid?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findCandidates(
      {
        propertyUuid,
        specializationUuid,
        regionUuids: regionUuid ? [regionUuid] : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      actor(r),
    );
  }

  @Post('assignments')
  @RequirePermissions('agents.assignment.manage')
  @ApiOperation({ summary: 'Assign a property to an eligible agent' })
  assignments(
    @Req() r: AuthRequest,
    @Body() dto: AssignmentCreateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.assign(
      dto.propertyUuid,
      dto.agentUuid,
      actor(r, ua, requestId),
      dto.reason,
    );
  }

  @Post('assignments/:propertyUuid/reassign')
  @RequirePermissions('agents.assignment.manage')
  reassign(
    @Req() r: AuthRequest,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Body() dto: ReassignmentDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.reassign(
      propertyUuid,
      dto.toAgentUuid,
      actor(r, ua, requestId),
      dto.fromAgentUuid,
      dto.reason,
    );
  }

  @Get(':uuid')
  @RequirePermissions('agents.read')
  get(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.get(uuid, actor(r));
  }

  @Patch(':uuid')
  @RequirePermissions('agents.manage')
  update(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: AgentUpdateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.update(uuid, dto, actor(r, ua, requestId));
  }

  @Delete(':uuid')
  @HttpCode(204)
  @RequirePermissions('agents.manage')
  archive(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.archive(uuid, actor(r, ua, requestId));
  }

  @Get(':uuid/specializations')
  @RequirePermissions('agents.read')
  specializationsForAgent(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.specializations(uuid, actor(r));
  }

  @Post(':uuid/specializations/:specializationUuid')
  @RequirePermissions('agents.specialization.manage')
  addSpecialization(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Param('specializationUuid', new ParseUUIDPipe({ version: '4' }))
    specializationUuid: string,
    @Query('primary') primary = 'false',
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.addSpecialization(
      uuid,
      specializationUuid,
      primary === 'true',
      actor(r, ua, requestId),
    );
  }

  @Delete(':uuid/specializations/:specializationUuid')
  @HttpCode(204)
  @RequirePermissions('agents.specialization.manage')
  removeSpecialization(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Param('specializationUuid', new ParseUUIDPipe({ version: '4' }))
    specializationUuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.removeSpecialization(
      uuid,
      specializationUuid,
      actor(r, ua, requestId),
    );
  }

  @Get(':uuid/coverage')
  @RequirePermissions('agents.read')
  coverage(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.listCoverage(uuid, actor(r));
  }

  @Post(':uuid/coverage')
  @RequirePermissions('agents.location.manage')
  addCoverage(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: CoverageCreateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.addCoverage(uuid, dto, actor(r, ua, requestId));
  }

  @Delete('coverage/:coverageUuid')
  @HttpCode(204)
  @RequirePermissions('agents.location.manage')
  removeCoverage(
    @Req() r: AuthRequest,
    @Param('coverageUuid', new ParseUUIDPipe({ version: '4' }))
    coverageUuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.removeCoverage(coverageUuid, actor(r, ua, requestId));
  }

  @Get(':uuid/availability')
  @RequirePermissions('agents.read')
  availability(
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.getAvailability(uuid);
  }

  @Put(':uuid/availability')
  @ApiOperation({ summary: 'Update self or managed availability' })
  @RequirePermissions('agents.availability.manage')
  updateAvailability(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: AvailabilityUpdateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.updateAvailability(uuid, dto, actor(r, ua, requestId));
  }

  @Get(':uuid/capacity')
  @RequirePermissions('agents.read')
  capacity(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.capacity(uuid, actor(r));
  }

  @Get(':uuid/assignments')
  @RequirePermissions('agents.read')
  assignmentList(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Query('history') history = 'false',
  ) {
    return this.service.assignments(uuid, history === 'true', actor(r));
  }

  @Delete(':uuid/assignments/:propertyUuid')
  @HttpCode(204)
  @RequirePermissions('agents.assignment.manage')
  unassign(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.unassign(propertyUuid, uuid, actor(r, ua, requestId));
  }

  @Get(':uuid/targets')
  @RequirePermissions('agents.target.read')
  targets(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.listTargets(uuid, actor(r));
  }

  @Post(':uuid/targets')
  @RequirePermissions('agents.target.manage')
  createTarget(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: TargetCreateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.createTarget(uuid, dto, actor(r, ua, requestId));
  }

  @Patch('targets/:targetUuid')
  @RequirePermissions('agents.target.manage')
  updateTarget(
    @Req() r: AuthRequest,
    @Param('targetUuid', new ParseUUIDPipe({ version: '4' }))
    targetUuid: string,
    @Body() dto: TargetUpdateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.updateTarget(targetUuid, dto, actor(r, ua, requestId));
  }

  @Delete('targets/:targetUuid')
  @HttpCode(204)
  @RequirePermissions('agents.target.manage')
  closeTarget(
    @Req() r: AuthRequest,
    @Param('targetUuid', new ParseUUIDPipe({ version: '4' }))
    targetUuid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service.closeTarget(targetUuid, actor(r, ua, requestId));
  }

  @Get(':uuid/performance')
  @RequirePermissions('agents.performance.read')
  performance(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.performance(uuid, actor(r));
  }
}
