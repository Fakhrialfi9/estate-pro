import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
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
    @Query('status') status?: AgentStatusDto,
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
  @ApiOperation({ summary: 'Find eligible agent candidates' })
  candidates(
    @Query('propertyUuid') propertyUuid?: string,
    @Query('specializationUuid') specializationUuid?: string,
    @Query('regionUuids') regionUuids?: string | string[],
    @Query('limit') limit?: string,
    @Req() r?: AuthRequest,
  ) {
    const regions = Array.isArray(regionUuids)
      ? regionUuids
      : regionUuids
        ? regionUuids.split(',').map((value) => value.trim())
        : undefined;
    return this.service.findCandidates(
      {
        propertyUuid,
        specializationUuid,
        regionUuids: regions,
        limit: limit ? Number(limit) : undefined,
      },
      r?.user?.sub ? actor(r) : undefined,
    );
  }

  @Get(':uuid')
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'Get an agent profile' })
  get(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.get(uuid, actor(r));
  }

  @Patch(':uuid')
  @RequirePermissions('agents.manage')
  @ApiOperation({ summary: 'Update an agent profile' })
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
  @ApiOperation({ summary: 'Archive an agent' })
  async archive(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    await this.service.archive(uuid, actor(r));
  }

  @Get(':uuid/specializations')
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'List agent specializations' })
  specializationsForAgent(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.specializations(uuid, actor(r));
  }

  @Post(':uuid/specializations/:specializationUuid')
  @RequirePermissions('agents.specialization.manage')
  @ApiOperation({ summary: 'Assign an agent specialization' })
  addSpecialization(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Param('specializationUuid', new ParseUUIDPipe({ version: '4' }))
    specializationUuid: string,
    @Query('primary') primary = 'false',
  ) {
    return this.service.addSpecialization(
      uuid,
      specializationUuid,
      primary === 'true',
      actor(r),
    );
  }

  @Delete(':uuid/specializations/:specializationUuid')
  @HttpCode(204)
  @RequirePermissions('agents.specialization.manage')
  @ApiOperation({ summary: 'Remove an agent specialization' })
  async removeSpecialization(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Param('specializationUuid', new ParseUUIDPipe({ version: '4' }))
    specializationUuid: string,
  ) {
    await this.service.removeSpecialization(uuid, specializationUuid, actor(r));
  }

  @Get(':uuid/coverage')
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'List agent geographic coverage' })
  coverage(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.listCoverage(uuid, actor(r));
  }

  @Post(':uuid/coverage')
  @RequirePermissions('agents.location.manage')
  @ApiOperation({ summary: 'Add agent geographic coverage' })
  addCoverage(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: CoverageCreateDto,
  ) {
    return this.service.addCoverage(uuid, dto, actor(r));
  }

  @Delete(':uuid/coverage/:coverageUuid')
  @HttpCode(204)
  @RequirePermissions('agents.location.manage')
  @ApiOperation({ summary: 'Remove agent geographic coverage' })
  async removeCoverage(
    @Req() r: AuthRequest,
    @Param('coverageUuid', new ParseUUIDPipe({ version: '4' })) coverageUuid: string,
  ) {
    await this.service.removeCoverage(coverageUuid, actor(r));
  }

  @Put(':uuid/availability')
  @RequirePermissions('agents.availability.manage')
  @ApiOperation({ summary: 'Update agent availability' })
  updateAvailability(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: AvailabilityUpdateDto,
  ) {
    return this.service.updateAvailability(uuid, dto, actor(r));
  }

  @Get(':uuid/availability')
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'Get agent availability' })
  availability(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.getAvailability(uuid);
  }

  @Get(':uuid/capacity')
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'Get agent capacity' })
  capacity(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.capacity(uuid, actor(r));
  }

  @Post(':uuid/assignments')
  @RequirePermissions('agents.assignment.manage')
  @ApiOperation({ summary: 'Assign property to an agent' })
  assign(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: AssignmentCreateDto,
  ) {
    return this.service.assign(dto.propertyUuid, uuid, actor(r), dto.reason);
  }

  @Post(':uuid/assignments/reassign')
  @RequirePermissions('agents.assignment.manage')
  @ApiOperation({ summary: 'Reassign property to an agent' })
  reassign(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: ReassignmentDto,
  ) {
    return this.service.reassign(
      dto.propertyUuid,
      uuid,
      actor(r),
      dto.fromAgentUuid,
      dto.reason,
    );
  }

  @Delete(':uuid/assignments')
  @HttpCode(204)
  @RequirePermissions('agents.assignment.manage')
  @ApiOperation({ summary: 'Unassign property from an agent' })
  async unassign(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Query('propertyUuid', new ParseUUIDPipe({ version: '4' }))
    propertyUuid: string,
  ) {
    await this.service.unassign(propertyUuid, uuid, actor(r));
  }

  @Get(':uuid/assignments')
  @RequirePermissions('agents.read')
  @ApiOperation({ summary: 'List agent property assignments' })
  assignments(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Query('history') history = 'false',
  ) {
    return this.service.assignments(uuid, history === 'true', actor(r));
  }

  @Get(':uuid/targets')
  @RequirePermissions('agents.target.read')
  @ApiOperation({ summary: 'List agent targets' })
  targets(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.listTargets(uuid, actor(r));
  }

  @Post(':uuid/targets')
  @RequirePermissions('agents.target.manage')
  @ApiOperation({ summary: 'Create agent target' })
  createTarget(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: TargetCreateDto,
  ) {
    return this.service.createTarget(uuid, dto, actor(r));
  }

  @Patch('targets/:targetUuid')
  @RequirePermissions('agents.target.manage')
  @ApiOperation({ summary: 'Update agent target' })
  updateTarget(
    @Req() r: AuthRequest,
    @Param('targetUuid', new ParseUUIDPipe({ version: '4' })) targetUuid: string,
    @Body() dto: TargetUpdateDto,
  ) {
    return this.service.updateTarget(targetUuid, dto, actor(r));
  }

  @Post('targets/:targetUuid/close')
  @RequirePermissions('agents.target.manage')
  @ApiOperation({ summary: 'Close agent target' })
  closeTarget(
    @Req() r: AuthRequest,
    @Param('targetUuid', new ParseUUIDPipe({ version: '4' })) targetUuid: string,
  ) {
    return this.service.closeTarget(targetUuid, actor(r));
  }

  @Get(':uuid/performance')
  @RequirePermissions('agents.performance.read')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  performance(
    @Req() r: AuthRequest,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service.performance(uuid, actor(r));
  }
}
