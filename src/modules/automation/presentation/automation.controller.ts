import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AutomationService } from '../application/services/automation.service.js';
import {
  CreateAssignmentRuleDto,
  CreateAutomationVersionDto,
  CreateAutomationWorkflowDto,
  CreateEscalationPolicyDto,
  CreateSlaPolicyDto,
  DispatchAutomationEventDto,
  PageAutomationQueryDto,
  UpdateAutomationWorkflowDto,
} from './automation.dto.js';

const actor = (req: Request): string =>
  (req.user as { sub?: string } | undefined)?.sub ?? '';

@ApiTags('Automation')
@ApiBearerAuth()
@Controller({ path: 'automation', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('workflows')
  @RequirePermissions('automation.workflows.read')
  @ApiOperation({ summary: 'List automation workflows' })
  @ApiResponse({ status: 200, type: Object })
  list(@Req() req: Request, @Query() query: PageAutomationQueryDto) {
    return this.automation.listWorkflows(query, actor(req));
  }

  @Post('workflows')
  @RequirePermissions('automation.workflows.create')
  @ApiOperation({ summary: 'Create an automation workflow' })
  @ApiResponse({ status: 201, type: Object })
  create(@Req() req: Request, @Body() dto: CreateAutomationWorkflowDto) {
    return this.automation.createWorkflow(dto, actor(req));
  }

  @Get('workflows/:uuid')
  @RequirePermissions('automation.workflows.read')
  @ApiResponse({ status: 200, type: Object })
  get(@Req() req: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.automation.getWorkflow(uuid, actor(req));
  }

  @Patch('workflows/:uuid')
  @RequirePermissions('automation.workflows.update')
  @ApiResponse({ status: 200, type: Object })
  update(
    @Req() req: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateAutomationWorkflowDto,
  ) {
    return this.automation.updateWorkflow(uuid, dto, actor(req));
  }

  @Post('workflows/:uuid/versions')
  @RequirePermissions('automation.workflows.update')
  @ApiResponse({ status: 201, type: Object })
  createVersion(
    @Req() req: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: CreateAutomationVersionDto,
  ) {
    return this.automation.createDraftVersion(
      uuid,
      {
        trigger: { type: dto.triggerType, entityType: 'LEAD' },
        graph: dto.definition,
      },
      actor(req),
    );
  }

  @Post('workflows/:uuid/versions/:versionUuid/activate')
  @RequirePermissions('automation.workflows.activate')
  @ApiResponse({ status: 201, type: Object })
  activate(
    @Req() req: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Param('versionUuid', ParseUUIDPipe) versionUuid: string,
  ) {
    return this.automation.publishActivate(uuid, versionUuid, actor(req));
  }

  @Post('workflows/:uuid/pause')
  @RequirePermissions('automation.workflows.pause')
  @ApiResponse({ status: 201, type: Object })
  pause(@Req() req: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.automation.pauseWorkflow(uuid, actor(req));
  }

  @Post('workflows/:uuid/archive')
  @RequirePermissions('automation.workflows.archive')
  @ApiResponse({ status: 201, type: Object })
  archive(@Req() req: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.automation.archiveWorkflow(uuid, actor(req));
  }

  @Post('events')
  @RequirePermissions('automation.execute')
  @ApiOperation({ summary: 'Dispatch a normalized automation event' })
  @ApiResponse({ status: 201, type: Object, isArray: true })
  dispatch(@Body() dto: DispatchAutomationEventDto) {
    return this.automation.dispatch({
      eventId: dto.eventId,
      occurredAt: new Date(),
      actorUuid: dto.actorUuid,
      entityType: dto.entityType,
      entityUuid: dto.entityUuid,
      action: dto.action,
      version: dto.version,
      payload: dto.payload ?? {},
    });
  }

  @Get('executions')
  @RequirePermissions('automation.executions.read')
  @ApiResponse({ status: 200, type: Object })
  executions(@Req() req: Request, @Query() query: PageAutomationQueryDto) {
    return this.automation.listExecutions(query, actor(req));
  }

  @Get('executions/:uuid')
  @RequirePermissions('automation.executions.read')
  @ApiResponse({ status: 200, type: Object })
  execution(@Req() req: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.automation.getExecution(uuid, actor(req));
  }

  @Post('executions/:uuid/retry')
  @RequirePermissions('automation.executions.retry')
  @ApiResponse({ status: 201, type: Object })
  retry(@Req() req: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.automation.retryExecution(uuid, actor(req));
  }

  @Post('executions/:uuid/cancel')
  @RequirePermissions('automation.executions.cancel')
  @ApiResponse({ status: 201, type: Object })
  cancel(@Req() req: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.automation.cancelExecution(uuid, actor(req));
  }

  @Post('workflows/:uuid/assignment-rules')
  @RequirePermissions('automation.workflows.update')
  @ApiResponse({ status: 201, type: Object })
  assignmentRule(
    @Req() req: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: CreateAssignmentRuleDto,
  ) {
    return this.automation.createAssignmentRule(uuid, dto, actor(req));
  }

  @Post('workflows/:uuid/sla-policies')
  @RequirePermissions('automation.workflows.update')
  @ApiResponse({ status: 201, type: Object })
  slaPolicy(
    @Req() req: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: CreateSlaPolicyDto,
  ) {
    return this.automation.createSlaPolicy(uuid, dto, actor(req));
  }

  @Post('workflows/:uuid/escalation-policies')
  @RequirePermissions('automation.workflows.update')
  @ApiResponse({ status: 201, type: Object })
  escalationPolicy(
    @Req() req: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: CreateEscalationPolicyDto,
  ) {
    return this.automation.createEscalationPolicy(uuid, dto, actor(req));
  }

  @Get('metrics')
  @RequirePermissions('automation.executions.read')
  @ApiResponse({ status: 200, type: Object })
  metrics(@Req() req: Request) {
    return this.automation.dashboard(actor(req));
  }
}
