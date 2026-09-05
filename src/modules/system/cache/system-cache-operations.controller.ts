import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import { Inject } from '@nestjs/common';
import {
  SYSTEM_CACHE,
  type SystemCachePort,
} from './system-cache.port.js';

@ApiTags('System Cache')
@ApiBearerAuth()
@Controller({ path: 'system/operations/cache', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class SystemCacheOperationsController {
  constructor(
    @Inject(SYSTEM_CACHE) private readonly cache: SystemCachePort,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  @Get()
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read safe cache statistics' })
  stats() {
    return this.cache.stats();
  }

  @Get('health')
  @RequirePermissions('system.operations.read')
  @ApiOperation({ summary: 'Read cache backend health' })
  health() {
    return this.cache.health();
  }

  @Delete(':namespace')
  @RequirePermissions('system.operations.update')
  @ApiOperation({ summary: 'Invalidate one cache namespace' })
  async clearNamespace(
    @Param('namespace') namespace: string,
    @Req() request: Request,
  ) {
    try {
      const count = await this.cache.invalidateNamespace(namespace);
      await this.audit.record({
        action: 'SYSTEM_SETTING_UPDATED',
        actorUuid: this.actor(request),
        subjectUuid: this.actor(request),
        entityType: 'system_setting',
        entityUuid: namespace,
        result: 'SUCCESS',
        reason: `cache.namespace.invalidated=${namespace};keys=${count}`,
      });
      return { namespace, keysDeleted: count };
    } catch {
      throw new BadRequestException('Invalid cache namespace');
    }
  }

  private actor(request: Request) {
    const actorUuid = (request.user as { sub?: string } | undefined)?.sub;
    if (!actorUuid) throw new Error('Authenticated actor missing');
    return actorUuid;
  }
}
