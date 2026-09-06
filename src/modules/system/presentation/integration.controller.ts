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
import { SystemIntegrationReliabilityService } from '../application/services/system-integration-reliability.service.js';
import { SystemIntegrationService } from '../application/services/system-integration.service.js';
import {
  CreateIntegrationDto,
  IntegrationListQueryDto,
  UpdateIntegrationDto,
} from './dto/integration.dto.js';

const integrationSchema = {
  type: 'object',
  required: [
    'uuid',
    'providerKey',
    'providerVersion',
    'capabilities',
    'state',
    'metadata',
    'secretConfigured',
    'lastTestAt',
    'lastSyncAt',
    'errorCode',
    'errorMessage',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    providerKey: { type: 'string' },
    providerVersion: { type: 'string' },
    capabilities: { type: 'array', items: { type: 'string' } },
    state: {
      type: 'string',
      enum: ['CONFIGURED', 'ACTIVE', 'DISABLED', 'ERROR', 'DISCONNECTED', 'CONNECTING'],
    },
    metadata: { type: 'object', additionalProperties: true },
    secretConfigured: { type: 'boolean' },
    lastTestAt: { type: 'string', format: 'date-time', nullable: true },
    lastSyncAt: { type: 'string', format: 'date-time', nullable: true },
    errorCode: { type: 'string', nullable: true },
    errorMessage: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const registrySchema = {
  type: 'object',
  required: ['data'],
  properties: {
    data: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'version', 'capabilities'],
        properties: {
          key: { type: 'string' },
          version: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const integrationListSchema = {
  type: 'object',
  required: ['items', 'total', 'page', 'limit'],
  properties: {
    items: { type: 'array', items: integrationSchema },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
  },
};

const integrationTestSchema = {
  type: 'object',
  required: ['uuid', 'ok', 'latencyMs', 'code', 'message'],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    ok: { type: 'boolean' },
    latencyMs: { type: 'number', minimum: 0 },
    code: { type: 'string', nullable: true },
    message: { type: 'string', nullable: true },
  },
};

const reconnectSchema = {
  type: 'object',
  required: ['uuid', 'ok', 'operationUuid', 'state', 'idempotentReplay'],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    ok: { type: 'boolean' },
    operationUuid: { type: 'string', format: 'uuid' },
    state: { type: 'string', enum: ['ACTIVE'] },
    latencyMs: { type: 'number', minimum: 0 },
    idempotentReplay: { type: 'boolean' },
  },
};

const syncSchema = {
  type: 'object',
  required: [
    'uuid',
    'state',
    'recordsRead',
    'recordsChanged',
    'code',
    'message',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    state: { type: 'string', enum: ['SUCCEEDED', 'FAILED'] },
    recordsRead: { type: 'integer', minimum: 0 },
    recordsChanged: { type: 'integer', minimum: 0 },
    code: { type: 'string', nullable: true },
    message: { type: 'string', nullable: true },
  },
};

const healthSchema = {
  type: 'object',
  required: ['ok', 'status', 'latencyMs'],
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string', enum: ['UP', 'DEGRADED', 'DOWN', 'UNKNOWN'] },
    latencyMs: { type: 'number', minimum: 0 },
    code: { type: 'string', nullable: true },
    message: { type: 'string', nullable: true },
  },
};

const reconciliationSchema = {
  type: 'object',
  required: [
    'uuid',
    'providerKey',
    'state',
    'status',
    'conflicts',
    'syncDirection',
    'syncCursor',
    'lastSyncedAt',
    'destructiveChanges',
  ],
  properties: {
    uuid: { type: 'string', format: 'uuid' },
    providerKey: { type: 'string' },
    state: { type: 'string' },
    status: { type: 'string', enum: ['CONFLICTS_FOUND', 'IN_SYNC'] },
    conflicts: { type: 'array', items: { type: 'object', additionalProperties: true } },
    syncDirection: { type: 'string', nullable: true },
    syncCursor: { type: 'string', nullable: true },
    lastSyncedAt: { type: 'string', format: 'date-time', nullable: true },
    destructiveChanges: { type: 'boolean' },
  },
};

const emptyDataSchema = {
  type: 'object',
  required: ['data'],
  properties: {
    data: { type: 'null' },
  },
};

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
  @ApiResponse({ status: 200, schema: registrySchema })
  registry() {
    return { data: this.integrations.registry() };
  }

  @Get()
  @RequirePermissions('system.integration.read')
  @ApiResponse({ status: 200, schema: integrationListSchema })
  list(@Query() query: IntegrationListQueryDto) {
    return this.integrations.list(query.page, query.limit, query.state);
  }

  @Post()
  @RequirePermissions('system.integration.create')
  @ApiResponse({ status: 201, schema: integrationSchema })
  create(@Req() request: Request, @Body() dto: CreateIntegrationDto) {
    return this.integrations.create(this.actor(request), dto);
  }

  @Get(':uuid')
  @RequirePermissions('system.integration.read')
  @ApiResponse({ status: 200, schema: integrationSchema })
  get(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.integrations.get(uuid);
  }

  @Get(':uuid/health')
  @RequirePermissions('system.integration.read')
  @ApiOperation({
    summary: 'Check external provider health for an integration',
  })
  @ApiResponse({ status: 200, schema: healthSchema })
  health(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.reliability.providerHealth(uuid);
  }

  @Patch(':uuid')
  @RequirePermissions('system.integration.update')
  @ApiResponse({ status: 200, schema: integrationSchema })
  update(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrations.update(this.actor(request), uuid, dto);
  }

  @Delete(':uuid')
  @RequirePermissions('system.integration.delete')
  @ApiResponse({ status: 200, schema: emptyDataSchema })
  async remove(
    @Req() request: Request,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    await this.integrations.remove(this.actor(request), uuid);
    return { data: null };
  }

  @Post(':uuid/test')
  @RequirePermissions('system.integration.test')
  @ApiResponse({ status: 201, schema: integrationTestSchema })
  test(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.integrations.test(this.actor(request), uuid);
  }

  @Post(':uuid/reconnect')
  @RequirePermissions('system.integration.test')
  @ApiOperation({ summary: 'Reconnect an integration and verify its health' })
  @ApiResponse({ status: 201, schema: reconnectSchema })
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
  @ApiResponse({ status: 201, schema: syncSchema })
  sync(@Req() request: Request, @Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.integrations.sync(this.actor(request), uuid);
  }

  @Get(':uuid/reconciliation')
  @RequirePermissions('system.integration.read')
  @ApiResponse({ status: 200, schema: reconciliationSchema })
  reconciliation(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.integrations.reconciliation(uuid);
  }

  private actor(request: Request) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return actorUuid;
  }
}
