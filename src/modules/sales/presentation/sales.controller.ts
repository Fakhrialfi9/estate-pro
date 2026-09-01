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
import { RequirePermissionsAny } from '../../../common/security/authorization.decorators.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { SalesService } from '../application/sales.service.js';
import type { SalesActor } from '../domain/sales.types.js';
import type {
  ActivityCreateDto,
  ActivityStatusDto,
  AssignOpportunityDto,
  AssociationDto,
  ClosingDto,
  CommissionCalculateDto,
  CommissionRuleDto,
  DealCreateDto,
  DealItemDto,
  DealItemUpdateDto,
  DealStatusDto,
  ForecastQueryDto,
  LostDto,
  LostReasonDto,
  NegotiationCreateDto,
  NegotiationStatusDto,
  OfferCreateDto,
  OfferStatusDto,
  OpportunityCreateDto,
  OpportunityUpdateDto,
  PageQueryDto,
  PipelineDto,
  ReorderStagesDto,
  ReopenDto,
  StageDto,
  TransitionDto,
  ViewingCommandDto,
  ViewingCreateDto,
} from './dto/sales.dto.js';

const actorOf = (request: Request, userAgent?: string, requestId?: string): SalesActor => ({
  actorUuid: (request.user as { sub?: string } | undefined)?.sub ?? '',
  permissions: (request.user as { permissions?: string[] } | undefined)?.permissions ?? [],
  ipAddress: request.ip,
  userAgent,
  requestId,
});

const data = (value: unknown) => ({ data: value });
const pageData = (value: { items: unknown[]; total: number; page: number; limit: number }) => ({
  data: value.items,
  meta: {
    page: value.page,
    limit: value.limit,
    total: value.total,
    totalPages: Math.ceil(value.total / value.limit),
  },
});

@ApiTags('Sales')
@ApiBearerAuth()
@Controller({ path: 'sales', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post('pipelines')
  @RequirePermissionsAny('sales.pipelines.create')
  @ApiOperation({ summary: 'Create Sales pipeline' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 409 })
  createPipeline(@Req() request: Request, @Body() dto: PipelineDto, @Headers('user-agent') ua?: string, @Headers('x-request-id') rid?: string) {
    return this.sales.createPipeline(dto, actorOf(request, ua, rid)).then(data);
  }

  @Get('pipelines')
  @RequirePermissionsAny('sales.pipelines.read')
  @ApiOperation({ summary: 'List Sales pipelines' })
  @ApiResponse({ status: 200 })
  listPipelines(@Req() request: Request, @Query() query: PageQueryDto) {
    return this.sales.listPipelines(query as unknown as Record<string, unknown>, actorOf(request)).then(pageData);
  }

  @Get('pipelines/:uuid')
  @RequirePermissionsAny('sales.pipelines.read')
  @ApiOperation({ summary: 'Get Sales pipeline' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  getPipeline(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.getPipeline(uuid, actorOf(request)).then(data);
  }

  @Patch('pipelines/:uuid')
  @RequirePermissionsAny('sales.pipelines.update')
  @ApiOperation({ summary: 'Update Sales pipeline' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409 })
  updatePipeline(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: PipelineDto) {
    return this.sales.updatePipeline(uuid, dto, actorOf(request)).then(data);
  }

  @Delete('pipelines/:uuid')
  @RequirePermissionsAny('sales.pipelines.archive')
  @ApiOperation({ summary: 'Archive Sales pipeline' })
  @ApiResponse({ status: 200 })
  archivePipeline(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.archivePipeline(uuid, actorOf(request)).then(data);
  }

  @Post('pipelines/:pipelineUuid/stages')
  @RequirePermissionsAny('sales.pipelines.stages.create')
  @ApiOperation({ summary: 'Create pipeline stage' })
  @ApiResponse({ status: 201 })
  createStage(@Req() request: Request, @Param('pipelineUuid', new ParseUUIDPipe({ version: '4' })) pipelineUuid: string, @Body() dto: StageDto) {
    return this.sales.createStage({ ...dto, pipelineUuid }, actorOf(request)).then(data);
  }

  @Get('pipelines/:pipelineUuid/stages')
  @RequirePermissionsAny('sales.pipelines.read')
  @ApiOperation({ summary: 'List pipeline stages' })
  @ApiResponse({ status: 200 })
  listStages(@Req() request: Request, @Param('pipelineUuid', new ParseUUIDPipe({ version: '4' })) pipelineUuid: string) {
    return this.sales.listStages(pipelineUuid, actorOf(request)).then(data);
  }

  @Patch('pipelines/:pipelineUuid/stages/reorder')
  @RequirePermissionsAny('sales.pipelines.stages.reorder')
  @ApiOperation({ summary: 'Atomically reorder pipeline stages' })
  @ApiResponse({ status: 200 })
  reorderStages(@Req() request: Request, @Param('pipelineUuid', new ParseUUIDPipe({ version: '4' })) pipelineUuid: string, @Body() dto: ReorderStagesDto) {
    return this.sales.reorderStages(pipelineUuid, dto.orderedStageUuids, actorOf(request)).then(data);
  }

  @Patch('stages/:uuid')
  @RequirePermissionsAny('sales.pipelines.stages.update')
  @ApiOperation({ summary: 'Update pipeline stage' })
  @ApiResponse({ status: 200 })
  updateStage(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: StageDto) {
    const { pipelineUuid: _pipelineUuid, ...input } = dto;
    void _pipelineUuid;
    return this.sales.updateStage(uuid, input, actorOf(request)).then(data);
  }

  @Delete('stages/:uuid')
  @RequirePermissionsAny('sales.pipelines.stages.update')
  @ApiOperation({ summary: 'Archive pipeline stage' })
  @ApiResponse({ status: 200 })
  archiveStage(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.archiveStage(uuid, actorOf(request)).then(data);
  }

  @Post('opportunities')
  @RequirePermissionsAny('sales.opportunities.create')
  @ApiOperation({ summary: 'Create Sales opportunity' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 409 })
  createOpportunity(@Req() request: Request, @Body() dto: OpportunityCreateDto, @Headers('user-agent') ua?: string, @Headers('x-request-id') rid?: string) {
    return this.sales.createOpportunity(dto, actorOf(request, ua, rid)).then(data);
  }

  @Get('opportunities')
  @RequirePermissionsAny('sales.opportunities.read')
  @ApiOperation({ summary: 'List Sales opportunities' })
  @ApiResponse({ status: 200 })
  listOpportunities(@Req() request: Request, @Query() query: PageQueryDto) {
    return this.sales.listOpportunities(query as unknown as Record<string, unknown>, actorOf(request)).then(pageData);
  }

  @Get('opportunities/:uuid')
  @RequirePermissionsAny('sales.opportunities.read')
  @ApiOperation({ summary: 'Get Sales opportunity' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  getOpportunity(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.getOpportunity(uuid, actorOf(request)).then(data);
  }

  @Patch('opportunities/:uuid')
  @RequirePermissionsAny('sales.opportunities.update')
  @ApiOperation({ summary: 'Update mutable opportunity fields only' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409 })
  updateOpportunity(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: OpportunityUpdateDto) {
    return this.sales.updateOpportunity(uuid, dto, actorOf(request)).then(data);
  }

  @Post('opportunities/:uuid/assign')
  @RequirePermissionsAny('sales.opportunities.assign')
  @ApiOperation({ summary: 'Assign or reassign opportunity' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  assignOpportunity(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: AssignOpportunityDto) {
    return this.sales.assignOpportunity(uuid, dto, actorOf(request)).then(data);
  }

  @Post('opportunities/:uuid/transition')
  @RequirePermissionsAny('sales.opportunities.transition')
  @ApiOperation({ summary: 'Execute an opportunity lifecycle transition' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409 })
  transitionOpportunity(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: TransitionDto) {
    return this.sales.transitionOpportunity(uuid, dto.toStatus, actorOf(request), dto.reason).then(data);
  }

  @Post('opportunities/:uuid/property')
  @RequirePermissionsAny('sales.opportunities.update')
  @ApiOperation({ summary: 'Attach Property reference by public UUID' })
  @ApiResponse({ status: 200 })
  attachProperty(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: AssociationDto) {
    return this.sales.attachProperty(uuid, dto.propertyUuid, actorOf(request)).then(data);
  }

  @Delete('opportunities/:uuid/property')
  @RequirePermissionsAny('sales.opportunities.update')
  @ApiOperation({ summary: 'Detach Property reference' })
  @ApiResponse({ status: 200 })
  detachProperty(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.detachProperty(uuid, actorOf(request)).then(data);
  }

  @Post('opportunities/:uuid/lost')
  @RequirePermissionsAny('sales.opportunities.lost')
  @ApiOperation({ summary: 'Mark opportunity lost with explicit reason' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409 })
  lostOpportunity(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: LostDto) {
    return this.sales.lostOpportunity(uuid, dto.reasonUuid, actorOf(request)).then(data);
  }

  @Get('opportunities/:uuid/stage-history')
  @RequirePermissionsAny('sales.opportunities.read')
  @ApiOperation({ summary: 'Read immutable opportunity stage history' })
  @ApiResponse({ status: 200 })
  stageHistory(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Query() query: PageQueryDto) {
    return this.sales.stageHistory(uuid, query as unknown as Record<string, unknown>, actorOf(request)).then(pageData);
  }

  @Post('activities')
  @RequirePermissionsAny('sales.activities.create')
  @ApiOperation({ summary: 'Create Sales activity' })
  @ApiResponse({ status: 201 })
  createActivity(@Req() request: Request, @Body() dto: ActivityCreateDto) {
    return this.sales.createActivity(dto as never, actorOf(request)).then(data);
  }

  @Get('activities')
  @RequirePermissionsAny('sales.activities.read')
  @ApiOperation({ summary: 'List Sales activities' })
  @ApiResponse({ status: 200 })
  listActivities(@Req() request: Request, @Query() query: PageQueryDto) {
    return this.sales.listActivities(query as unknown as Record<string, unknown>, actorOf(request)).then(pageData);
  }

  @Post('activities/:uuid/status')
  @RequirePermissionsAny('sales.activities.update')
  @ApiOperation({ summary: 'Complete or cancel activity' })
  @ApiResponse({ status: 200 })
  activityStatus(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: ActivityStatusDto) {
    return this.sales.activityStatus(uuid, dto.status as never, actorOf(request)).then(data);
  }

  @Post('viewings')
  @RequirePermissionsAny('sales.viewings.create')
  @ApiOperation({ summary: 'Create property viewing schedule' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409 })
  createViewing(@Req() request: Request, @Body() dto: ViewingCreateDto) {
    return this.sales.createViewing(dto, actorOf(request)).then(data);
  }

  @Get('viewings')
  @RequirePermissionsAny('sales.viewings.read')
  @ApiOperation({ summary: 'List viewing schedules' })
  @ApiResponse({ status: 200 })
  listViewings(@Req() request: Request, @Query() query: PageQueryDto) {
    return this.sales.listViewings(query as unknown as Record<string, unknown>, actorOf(request)).then(pageData);
  }

  @Post('viewings/:uuid/status')
  @RequirePermissionsAny('sales.viewings.update')
  @ApiOperation({ summary: 'Confirm, reschedule, complete, cancel, or mark no-show' })
  @ApiResponse({ status: 200 })
  viewingStatus(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: ViewingCommandDto) {
    return this.sales.viewingStatus(uuid, dto.status as never, dto.scheduledAt, actorOf(request)).then(data);
  }

  @Post('negotiations')
  @RequirePermissionsAny('sales.negotiations.create')
  @ApiOperation({ summary: 'Start negotiation for opportunity' })
  @ApiResponse({ status: 201 })
  createNegotiation(@Req() request: Request, @Body() dto: NegotiationCreateDto) {
    const actor = actorOf(request);
    return this.sales.startNegotiation({ ...dto, openedByUuid: actor.actorUuid }, actor).then(data);
  }

  @Post('negotiations/:uuid/status')
  @RequirePermissionsAny('sales.negotiations.transition')
  @ApiOperation({ summary: 'Transition negotiation state' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409 })
  negotiationStatus(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: NegotiationStatusDto) {
    return this.sales.negotiationStatus(uuid, dto.status as never, actorOf(request)).then(data);
  }

  @Get('negotiations/:uuid/history')
  @RequirePermissionsAny('sales.negotiations.read')
  @ApiOperation({ summary: 'Read negotiation history' })
  @ApiResponse({ status: 200 })
  negotiationHistory(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.negotiationHistory(uuid, actorOf(request)).then(data);
  }

  @Post('offers')
  @RequirePermissionsAny('sales.offers.create')
  @ApiOperation({ summary: 'Create immutable offer version' })
  @ApiResponse({ status: 201 })
  createOffer(@Req() request: Request, @Body() dto: OfferCreateDto) {
    return this.sales.createOffer(dto, actorOf(request)).then(data);
  }

  @Get('negotiations/:uuid/offers')
  @RequirePermissionsAny('sales.offers.read')
  @ApiOperation({ summary: 'List versioned offer history' })
  @ApiResponse({ status: 200 })
  offers(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.offers(uuid, actorOf(request)).then(data);
  }

  @Post('offers/:uuid/status')
  @RequirePermissionsAny('sales.offers.transition')
  @ApiOperation({ summary: 'Accept, reject, or expire offer' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409 })
  offerStatus(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: OfferStatusDto) {
    return this.sales.offerStatus(uuid, dto.status as never, actorOf(request)).then(data);
  }

  @Post('deals')
  @RequirePermissionsAny('sales.deals.create')
  @ApiOperation({ summary: 'Convert eligible opportunity into deal' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409 })
  createDeal(@Req() request: Request, @Body() dto: DealCreateDto) {
    return this.sales.createDeal(dto, actorOf(request)).then(data);
  }

  @Get('deals')
  @RequirePermissionsAny('sales.deals.read')
  @ApiOperation({ summary: 'List Sales deals' })
  @ApiResponse({ status: 200 })
  listDeals(@Req() request: Request, @Query() query: PageQueryDto) {
    return this.sales.listDeals(query as unknown as Record<string, unknown>, actorOf(request)).then(pageData);
  }

  @Get('deals/:uuid')
  @RequirePermissionsAny('sales.deals.read')
  @ApiOperation({ summary: 'Get deal with items, closing, and commission' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  getDeal(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.getDeal(uuid, actorOf(request)).then(data);
  }

  @Post('deals/:uuid/items')
  @RequirePermissionsAny('sales.deals.items.update')
  @ApiOperation({ summary: 'Add deal line item' })
  @ApiResponse({ status: 201 })
  addDealItem(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: DealItemDto) {
    return this.sales.addDealItem(uuid, dto, actorOf(request)).then(data);
  }

  @Patch('deal-items/:uuid')
  @RequirePermissionsAny('sales.deals.items.update')
  @ApiOperation({ summary: 'Update deal line item' })
  @ApiResponse({ status: 200 })
  updateDealItem(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: DealItemUpdateDto) {
    return this.sales.updateDealItem(uuid, dto, actorOf(request)).then(data);
  }

  @Delete('deal-items/:uuid')
  @RequirePermissionsAny('sales.deals.items.update')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove deal line item' })
  @ApiResponse({ status: 204 })
  removeDealItem(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.removeDealItem(uuid, actorOf(request));
  }

  @Post('deals/:uuid/status')
  @RequirePermissionsAny('sales.deals.transition')
  @ApiOperation({ summary: 'Transition deal lifecycle' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409 })
  dealStatus(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: DealStatusDto) {
    return this.sales.dealStatus(uuid, dto.status as never, actorOf(request)).then(data);
  }

  @Post('deals/:uuid/close')
  @RequirePermissionsAny('sales.closing.create')
  @ApiOperation({ summary: 'Close a deal exactly once' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409 })
  closeDeal(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: ClosingDto) {
    return this.sales.closeDeal(uuid, dto, actorOf(request)).then(data);
  }

  @Post('deals/:uuid/lost')
  @RequirePermissionsAny('sales.deals.lost')
  @ApiOperation({ summary: 'Mark deal lost with explicit reason' })
  @ApiResponse({ status: 200 })
  lostDeal(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: LostDto) {
    return this.sales.lostDeal(uuid, dto.reasonUuid, actorOf(request)).then(data);
  }

  @Post('deals/:uuid/reopen')
  @RequirePermissionsAny('sales.deals.reopen')
  @ApiOperation({ summary: 'Reopen a deal according to policy' })
  @ApiResponse({ status: 409 })
  reopenDeal(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: ReopenDto) {
    return this.sales.reopenDeal(uuid, dto.reason, actorOf(request)).then(data);
  }

  @Get('lost-reasons')
  @RequirePermissionsAny('sales.lost-reasons.read')
  @ApiOperation({ summary: 'List active lost reasons' })
  @ApiResponse({ status: 200 })
  lostReasons(@Req() request: Request) {
    return this.sales.lostReasons(actorOf(request)).then(data);
  }

  @Post('lost-reasons')
  @RequirePermissionsAny('sales.lost-reasons.manage')
  @ApiOperation({ summary: 'Create lost reason reference data' })
  @ApiResponse({ status: 201 })
  createLostReason(@Req() request: Request, @Body() dto: LostReasonDto) {
    return this.sales.createLostReason(dto, actorOf(request)).then(data);
  }

  @Patch('lost-reasons/:uuid')
  @RequirePermissionsAny('sales.lost-reasons.manage')
  @ApiOperation({ summary: 'Update lost reason reference data' })
  @ApiResponse({ status: 200 })
  updateLostReason(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: LostReasonDto) {
    return this.sales.updateLostReason(uuid, dto, actorOf(request)).then(data);
  }

  @Post('commission/rules')
  @RequirePermissionsAny('sales.commission.rules.manage')
  @ApiOperation({ summary: 'Create commission rule' })
  @ApiResponse({ status: 201 })
  createCommissionRule(@Req() request: Request, @Body() dto: CommissionRuleDto) {
    return this.sales.createCommissionRule(dto, actorOf(request)).then(data);
  }

  @Post('deals/:uuid/commission/calculate')
  @RequirePermissionsAny('sales.commission.calculate')
  @ApiOperation({ summary: 'Calculate commission from authoritative closed deal' })
  @ApiResponse({ status: 201 })
  calculateCommission(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string, @Body() dto: CommissionCalculateDto) {
    return this.sales.calculateCommission(uuid, dto, actorOf(request)).then(data);
  }

  @Post('commission/:uuid/approve')
  @RequirePermissionsAny('sales.commission.approve')
  @ApiOperation({ summary: 'Approve commission' })
  @ApiResponse({ status: 200 })
  approveCommission(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.approveCommission(uuid, actorOf(request)).then(data);
  }

  @Post('commission/:uuid/settle')
  @RequirePermissionsAny('sales.commission.settle')
  @ApiOperation({ summary: 'Settle commission' })
  @ApiResponse({ status: 200 })
  settleCommission(@Req() request: Request, @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
    return this.sales.settleCommission(uuid, actorOf(request)).then(data);
  }

  @Get('commission/report')
  @RequirePermissionsAny('sales.commission.read')
  @ApiOperation({ summary: 'Read-only commission report' })
  @ApiResponse({ status: 200 })
  commissionReport(@Req() request: Request, @Query() query: PageQueryDto) {
    return this.sales.commissionReport(query as unknown as Record<string, unknown>, actorOf(request)).then(data);
  }

  @Get('forecast')
  @RequirePermissionsAny('sales.forecast.read')
  @ApiOperation({ summary: 'Read weighted Sales forecast' })
  @ApiResponse({ status: 200 })
  forecast(@Req() request: Request, @Query() query: ForecastQueryDto) {
    return this.sales.forecast(query as unknown as Record<string, unknown>, actorOf(request)).then(data);
  }
}
