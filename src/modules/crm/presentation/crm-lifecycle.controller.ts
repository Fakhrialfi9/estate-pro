import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { CrmLifecycleService } from '../application/crm-lifecycle.service.js';
import { PageDto } from './crm.dto.js';

class QualifyDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason!: string;
}

class ClosureDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason?: string;

  @ApiProperty({ enum: ['WON', 'LOST', 'DISQUALIFIED', 'OTHER'] })
  @IsIn(['WON', 'LOST', 'DISQUALIFIED', 'OTHER'])
  outcome!: 'WON' | 'LOST' | 'DISQUALIFIED' | 'OTHER';
}

const actor = (request: Request, userAgent?: string, requestId?: string) => ({
  actorUuid: request.user?.sub ?? '',
  permissions: request.user?.permissions ?? [],
  ipAddress: request.ip,
  userAgent,
  requestId,
});

const lifecycleSuccessResponse = (description: string) =>
  ApiResponse({
    status: 200,
    description,
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['data'],
    },
  });

const lifecycleListResponse = (description: string) =>
  ApiResponse({
    status: 200,
    description,
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1 },
            total: { type: 'integer', minimum: 0 },
            totalPages: { type: 'integer', minimum: 0 },
          },
          required: ['page', 'limit', 'total', 'totalPages'],
        },
      },
      required: ['data', 'meta'],
    },
  });

@ApiTags('CRM Lead Lifecycle')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@Controller({ path: 'crm/leads', version: '1' })
export class CrmLifecycleController {
  constructor(private readonly service: CrmLifecycleService) {}

  @Post(':uuid/qualify')
  @RequirePermissions('crm.leads.qualify')
  @ApiOperation({ summary: 'Qualify a lead with an explicit reason' })
  @ApiParam({ name: 'uuid' })
  @lifecycleSuccessResponse('Qualified lead')
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  qualify(
    @Req() request: Request,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: QualifyDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.service
      .qualify(uuid, dto.reason, actor(request, userAgent, requestId))
      .then((data) => ({ data }));
  }

  @Post(':uuid/nurture')
  @RequirePermissions('crm.leads.nurture')
  @ApiOperation({ summary: 'Start lead nurturing' })
  @lifecycleSuccessResponse('Nurturing workflow started')
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  nurture(
    @Req() request: Request,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service
      .nurtureWorkflow(uuid, actor(request))
      .then((data) => ({ data }));
  }

  @Post(':uuid/reactivate')
  @RequirePermissions('crm.leads.reactivate')
  @ApiOperation({ summary: 'Reactivate an eligible closed lead' })
  @lifecycleSuccessResponse('Reactivated lead')
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  reactivate(
    @Req() request: Request,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
  ) {
    return this.service
      .reactivate(uuid, actor(request))
      .then((data) => ({ data }));
  }

  @Post(':uuid/close')
  @RequirePermissions('crm.leads.close')
  @ApiOperation({ summary: 'Close a lead with an explicit reason and outcome' })
  @lifecycleSuccessResponse('Closed lead')
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  close(
    @Req() request: Request,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Body() dto: ClosureDto,
  ) {
    return this.service
      .close(uuid, dto.reason ?? '', dto.outcome, actor(request))
      .then((data) => ({ data }));
  }

  @Post(':uuid/convert')
  @RequirePermissions('crm.leads.convert')
  @ApiOperation({ summary: 'Convert a qualified lead into Sales' })
  @lifecycleSuccessResponse('Converted lead')
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 409 })
  convert(
    @Req() request: Request,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service
      .convert(uuid, actor(request), idempotencyKey)
      .then((data) => ({ data }));
  }

  @Get(':uuid/timeline')
  @RequirePermissions('crm.leads.read')
  @ApiOperation({ summary: 'Unified, paginated lead timeline read model' })
  @lifecycleListResponse('Paginated lead timeline')
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  timeline(
    @Req() request: Request,
    @Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string,
    @Query() query: PageDto,
  ) {
    return this.service.timeline(uuid, query, actor(request)).then((data) => ({
      data: data.items,
      meta: {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: Math.ceil(data.total / data.limit),
      },
    }));
  }
}
