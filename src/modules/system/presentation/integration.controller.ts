import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemIntegrationReliabilityService } from '../application/services/system-integration-reliability.service.js';
import { SystemIntegrationService } from '../application/services/system-integration.service.js';
import {
  CreateIntegrationDto,
  IntegrationListQueryDto,
  UpdateIntegrationDto,
} from './dto/integration.dto.js';

@ApiTags('System Integrations')
@ApiBearerAuth()
@Controller({ path: 'system/integrations', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class IntegrationController {
  constructor(
    private readonly integrations: SystemIntegrationService,
    private readonly reliability: SystemIntegrationReliabilityService,
  ) {}

  @Get('registry')
  @RequirePermissions('system.integration.read')
  @ApiOperation({ summary: 'List registered provider adapters' })
  registry() {
    return { data: this.integrations.registry() };
  }

  @Get()
  @RequirePermissions('system.integration.read')
  list(@Query() query: IntegrationListQueryDto) {
    return this.integrations.list(query.page, query.limit, query.state);
  }

  @Post()
  @RequirePermissions('system.integration.create')
  create(@Req() request: Request, @Body() dto: CreateIntegrationDto) {
    return this.integrations.create(this.actor(request), dto);
  }

  @Get(':uuid')
  @RequirePermissions('system.integration.read')
  get(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.integrations.get(uuid);
  }

  @Get(':uuid/health')
  @RequirePermissions('system.integration.read')
  @ApiOperation({ summary: 'Check external provider health for an integration' })
  health(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.reliability.providerHealth(uuid);
  }

  @Patch(':uuid')
  @RequirePermissions('system.integration.update')
  update(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrations.update(this.actor(request), uuid, dto);
  }

  @Delete(':uuid')
  @RequirePermissions('system.integration.delete')
  async remove(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    await this.integrations.remove(this.actor(request), uuid);
    return { data: null };
  }

  @Post(':uuid/test')
  @RequirePermissions('system.integration.test')
  test(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.integrations.test(this.actor(request), uuid);
  }

  @Post(':uuid/reconnect')
  @RequirePermissions('system.integration.test')
  @ApiOperation({ summary: 'Reconnect an integration and verify its health' })
  reconnect(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.integrations.reconnect(
      this.actor(request),
      uuid,
      idempotencyKey,
    );
  }

  @Post(':uuid/sync')
  @RequirePermissions('system.integration.sync')
  sync(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.integrations.sync(this.actor(request), uuid);
  }

  @Get(':uuid/reconciliation')
  @RequirePermissions('system.integration.read')
  reconciliation(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.integrations.reconciliation(uuid);
  }

  private actor(request: Request) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return actorUuid;
  }
}
