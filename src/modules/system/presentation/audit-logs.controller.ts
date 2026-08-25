import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/auth.module.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { AUDIT_ACTIONS } from '../../../common/audit/audit-events.js';
import { AUDIT_QUERY_REPOSITORY } from '../../../common/audit/audit-query.port.js';
import type { AuditQueryRepository } from '../../../common/audit/audit-query.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import { AuditLogQueryDto } from './audit-log-query.dto.js';

const AUDIT_READ_PERMISSION = 'audit:read';
type AuditRequest = Request & { user?: { sub?: string } };

@ApiTags('Audit')
@ApiBearerAuth()
@Controller({ path: 'system/audit-logs', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class AuditLogsController {
  constructor(
    @Inject(AUDIT_QUERY_REPOSITORY)
    private readonly auditQuery: AuditQueryRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  @RequirePermissions(AUDIT_READ_PERMISSION)
  @Get()
  @ApiOperation({
    summary: 'Query audit logs',
    description: `Requires ${AUDIT_READ_PERMISSION}. Records are immutable; this endpoint only reads paginated, filtered audit data and records the audit access itself.`,
  })
  async list(
    @Req() request: AuditRequest,
    @Query() query: AuditLogQueryDto,
  ): Promise<unknown> {
    if (!request.user?.sub)
      throw new BadRequestException('Authenticated actor missing');
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from.getTime() > to.getTime())
      throw new BadRequestException('Audit log date range is invalid');
    const result = await this.auditQuery.list({
      page: query.page,
      limit: query.limit,
      ...(query.actorUuid ? { actorUuid: query.actorUuid } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.AUDIT_LOG_ACCESSED,
      actorUuid: request.user.sub,
      entityType: 'AuditLog',
      result: 'SUCCESS',
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(request.get('user-agent') !== undefined
        ? { userAgent: request.get('user-agent') }
        : {}),
      ...(request.get('x-request-id') !== undefined
        ? { requestId: request.get('x-request-id') }
        : {}),
    });
    return {
      items: result.items,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }
}
