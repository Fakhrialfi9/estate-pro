import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/auth.module.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { AuditLogService } from '../../audit/application/audit-log.service.js';
import { AuditLogQueryDto } from '../../audit/application/dto/audit-log-query.dto.js';
import { AUDIT_ACTIONS } from '../../../common/audit/audit-events.js';

const AUDIT_READ_PERMISSION = 'audit:read';
type AuditRequest = Request & { user?: { sub?: string } };

@Controller({ path: 'system/audit-logs', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class AuditLogsController {
  constructor(private readonly audit: AuditLogService) {}

  @RequirePermissions(AUDIT_READ_PERMISSION)
  @Get()
  async list(@Req() request: AuditRequest, @Query() query: AuditLogQueryDto): Promise<unknown> {
    if (!request.user?.sub) throw new BadRequestException('Authenticated actor missing');
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from.getTime() > to.getTime()) throw new BadRequestException('Audit log date range is invalid');
    const result = await this.audit.list({
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
      ipAddress: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
      requestId: request.get('x-request-id') ?? undefined,
    });

    return {
      items: result.items.map((item) => ({
        uuid: item.props.uuid,
        actorUuid: item.props.actorUuid,
        actorType: item.props.actorType,
        subjectUuid: item.props.subjectUuid,
        action: item.props.action,
        resourceType: item.props.resourceType,
        resourceId: item.props.resourceId,
        result: item.props.result,
        reason: item.props.reason,
        ipAddress: item.props.ipAddress,
        userAgent: item.props.userAgent,
        requestId: item.props.requestId,
        createdAt: item.props.createdAt,
        changes: item.props.changes,
      })),
      meta: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) },
    };
  }
}
