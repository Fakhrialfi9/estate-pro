import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SystemEnvironmentService } from '../application/services/system-environment.service.js';
import { SystemIntegrationCredentialService } from '../application/services/system-integration-credential.service.js';
import { SystemIntegrationService } from '../application/services/system-integration.service.js';
import { SystemIntegrationSyncService } from '../application/services/system-integration-sync.service.js';
import { SystemOperationalAlertService } from '../application/services/system-operational-alert.service.js';
import { SystemRoadmapControlService } from '../application/services/system-roadmap-control.service.js';
import {
  AlertQueryDto,
  ConflictQueryDto,
  CreateConflictDto,
  CreateCredentialDto,
  CreateEventDto,
  CreateImportProfileDto,
  CreateOperationDto,
  CredentialQueryDto,
  EvaluateFeatureFlagDto,
  EventQueryDto,
  FailOperationDto,
  FeatureFlagQueryDto,
  ImportProfileQueryDto,
  OperationQueryDto,
  ResolveConflictDto,
  RotateCredentialDto,
  RuntimeUpdateDto,
  SetFeatureFlagDto,
  UpdateImportProfileDto,
} from './dto/system-roadmap.dto.js';

@ApiTags('System Control Plane')
@ApiBearerAuth()
@Controller({ path: 'system/control', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class SystemRoadmapControlController {
  constructor(
    private readonly control: SystemRoadmapControlService,
    private readonly environment: SystemEnvironmentService,
    private readonly integration: SystemIntegrationService,
    private readonly sync: SystemIntegrationSyncService,
    private readonly credentials: SystemIntegrationCredentialService,
    private readonly alertsService: SystemOperationalAlertService,
  ) {}

  @Get('dashboard')
  @RequirePermissions('system.dashboard.read')
  @ApiOperation({ summary: 'Read system executive dashboard' })
  dashboard() {
    return this.control.dashboard();
  }
  @Get('environment')
  @RequirePermissions('system.dashboard.read')
  environmentMetadata() {
    return this.environment.read();
  }
  @Get('flags') @RequirePermissions('system.flags.read') flags(
    @Query() q: FeatureFlagQueryDto,
  ) {
    return this.control.listFlags(q.environment);
  }
  @Post('flags') @RequirePermissions('system.flags.update') setFlag(
    @Req() req: Request,
    @Body() dto: SetFeatureFlagDto,
  ) {
    return this.control.setFlag(actor(req), dto);
  }
  @Post('flags/evaluate') @RequirePermissions('system.flags.read') evaluate(
    @Body() dto: EvaluateFeatureFlagDto,
  ) {
    return this.control.evaluateFlag(dto.key, dto.environment, dto.subjectKey);
  }
  @Get('import-profiles')
  @RequirePermissions('system.import.profile.read')
  profiles(@Query() q: ImportProfileQueryDto) {
    return this.control.listImportProfiles(q.entity, q.active);
  }
  @Post('import-profiles')
  @RequirePermissions('system.import.profile.create')
  createProfile(@Req() req: Request, @Body() dto: CreateImportProfileDto) {
    return this.control.createImportProfile(actor(req), dto);
  }
  @Get('import-profiles/:uuid')
  @RequirePermissions('system.import.profile.read')
  profile(@Param('uuid') uuid: string) {
    return this.control.getImportProfile(uuid);
  }
  @Patch('import-profiles/:uuid')
  @RequirePermissions('system.import.profile.update')
  updateProfile(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateImportProfileDto,
  ) {
    return this.control.updateImportProfile(
      actor(req),
      uuid,
      dto as unknown as Record<string, unknown>,
    );
  }
  @Get('integrations/:uuid/credentials')
  @RequirePermissions('system.integration.credentials.read')
  credentialsList(@Param('uuid') uuid: string, @Query() q: CredentialQueryDto) {
    return this.control.credentials(uuid, q.credentialType);
  }
  @Post('integrations/:uuid/credentials')
  @RequirePermissions('system.integration.credentials.update')
  createCredential(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: CreateCredentialDto,
  ) {
    return this.control.createCredential(actor(req), uuid, {
      ...dto,
      accessTokenExpiresAt: dto.accessTokenExpiresAt
        ? new Date(dto.accessTokenExpiresAt)
        : null,
      refreshTokenExpiresAt: dto.refreshTokenExpiresAt
        ? new Date(dto.refreshTokenExpiresAt)
        : null,
    });
  }
  @Post('credentials/:uuid/rotate')
  @RequirePermissions('system.integration.credentials.update')
  rotateCredential(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: RotateCredentialDto,
  ) {
    return this.control.rotateCredential(actor(req), uuid, {
      ...dto,
      accessTokenExpiresAt: dto.accessTokenExpiresAt
        ? new Date(dto.accessTokenExpiresAt)
        : null,
      refreshTokenExpiresAt: dto.refreshTokenExpiresAt
        ? new Date(dto.refreshTokenExpiresAt)
        : null,
    });
  }
  @Post('integrations/:integrationUuid/credentials/:credentialUuid/refresh')
  @RequirePermissions('system.integration.credentials.update')
  refreshCredential(
    @Req() req: Request,
    @Param('integrationUuid') integrationUuid: string,
    @Param('credentialUuid') credentialUuid: string,
  ) {
    return this.integration
      .providerFor(integrationUuid)
      .then((provider) =>
        this.credentials.refresh(credentialUuid, actor(req), provider),
      );
  }
  @Post('credentials/:uuid/revoke')
  @RequirePermissions('system.integration.credentials.update')
  revokeCredential(@Req() req: Request, @Param('uuid') uuid: string) {
    return this.control.revokeCredential(actor(req), uuid);
  }
  @Get('integrations/:uuid/runtime')
  @RequirePermissions('system.integration.runtime.read')
  runtime(@Param('uuid') uuid: string) {
    return this.control.runtime(uuid);
  }
  @Patch('integrations/:uuid/runtime')
  @RequirePermissions('system.integration.runtime.update')
  configureRuntime(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: RuntimeUpdateDto,
  ) {
    return this.control.configureRuntime(actor(req), uuid, dto);
  }
  @Post('integrations/:uuid/sync/push')
  @RequirePermissions('system.integration.sync')
  push(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body()
    body: {
      resourceType: string;
      resourceUuid?: string;
      payload: Record<string, unknown>;
      idempotencyKey: string;
    },
  ) {
    return this.sync.push(actor(req), uuid, body);
  }
  @Post('integrations/:uuid/sync/pull')
  @RequirePermissions('system.integration.sync')
  pull(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() body: { resourceType: string; limit?: number },
  ) {
    return this.sync.pull(actor(req), uuid, body);
  }
  @Post('integrations/:uuid/sync')
  @RequirePermissions('system.integration.sync')
  bidirectional(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body()
    body: {
      resourceType: string;
      resourceUuid?: string;
      payload?: Record<string, unknown>;
      idempotencyKey?: string;
      limit?: number;
    },
  ) {
    return this.sync.bidirectional(actor(req), uuid, body);
  }
  @Get('integrations/:uuid/operations')
  @RequirePermissions('system.integration.operation.read')
  operations(@Param('uuid') uuid: string, @Query() q: OperationQueryDto) {
    return this.control.listOperations(uuid, q.state, q.limit);
  }
  @Post('integrations/:uuid/operations')
  @RequirePermissions('system.integration.operation.create')
  operation(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: CreateOperationDto,
  ) {
    return this.control.operation(actor(req), uuid, dto);
  }
  @Post('operations/:uuid/complete')
  @RequirePermissions('system.integration.operation.update')
  complete(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.control.completeOperation(actor(req), uuid, body);
  }
  @Post('operations/:uuid/fail')
  @RequirePermissions('system.integration.operation.update')
  fail(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: FailOperationDto,
  ) {
    return this.control.failOperation(actor(req), uuid, dto);
  }
  @Get('integrations/:uuid/events')
  @RequirePermissions('system.integration.event.read')
  events(@Param('uuid') uuid: string, @Query() q: EventQueryDto) {
    return this.control.listEvents(uuid, q.status, q.limit);
  }
  @Post('integrations/:uuid/events')
  @RequirePermissions('system.integration.event.create')
  event(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.control.emitEvent(actor(req), uuid, dto);
  }
  @Post('events/:uuid/process')
  @RequirePermissions('system.integration.event.update')
  processEvent(@Req() req: Request, @Param('uuid') uuid: string) {
    return this.control.processEvent(actor(req), uuid);
  }
  @Get('integrations/:uuid/conflicts')
  @RequirePermissions('system.integration.conflict.read')
  conflicts(@Param('uuid') uuid: string, @Query() q: ConflictQueryDto) {
    return this.control.conflicts(uuid, q.status, q.limit);
  }
  @Post('integrations/:uuid/conflicts')
  @RequirePermissions('system.integration.conflict.update')
  conflict(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() dto: CreateConflictDto,
  ) {
    return this.control.recordConflict(actor(req), uuid, dto);
  }
  @Post('integrations/:uuid/conflicts/:conflictKey/resolve')
  @RequirePermissions('system.integration.conflict.update')
  resolveConflict(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Param('conflictKey') key: string,
    @Body() dto: ResolveConflictDto,
  ) {
    return this.control.resolveConflict(actor(req), uuid, key, dto.resolution);
  }
  @Get('alerts') @RequirePermissions('system.alert.read') alerts(
    @Query() q: AlertQueryDto,
  ) {
    return this.control.alerts(q.status, q.severity, q.limit);
  }
  @Post('alerts/evaluate')
  @RequirePermissions('system.alert.update')
  evaluateAlerts(
    @Body() body: { signals: Record<string, number>; resourceUuid?: string },
  ) {
    return this.alertsService.evaluate(body);
  }
  @Post('alerts/:uuid/acknowledge')
  @RequirePermissions('system.alert.update')
  acknowledgeAlert(@Req() req: Request, @Param('uuid') uuid: string) {
    return this.alertsService.acknowledge(actor(req), uuid);
  }
  @Post('alerts/:uuid/resolve')
  @RequirePermissions('system.alert.update')
  resolveAlert(@Req() req: Request, @Param('uuid') uuid: string) {
    return this.control.resolveAlert(actor(req), uuid);
  }
  @Post('integrations/:uuid/resync')
  @RequirePermissions('system.integration.sync')
  resync(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() body: { direction: string; entityType?: string },
  ) {
    return this.control.resync(
      actor(req),
      uuid,
      body.direction,
      body.entityType,
    );
  }
}

function actor(req: Request): string {
  const id = (req.user as { sub?: string } | undefined)?.sub;
  if (!id) throw new UnauthorizedException('Authenticated actor missing');
  return id;
}
