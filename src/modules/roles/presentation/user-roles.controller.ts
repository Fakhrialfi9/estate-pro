import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/auth.module.js';
import type { RoleActor } from '../application/policies/role-authorization.policy.js';
import {
  UserRoleService,
  type UserRoleMutationAuditContext,
} from '../application/services/user-role.service.js';
import {
  RoleReadAccessGuard,
  RoleManageAccessGuard,
} from '../security/role-management-access.guard.js';
import { AssignUserRoleDto } from './dto/assign-user-role.dto.js';
import { UserRoleQueryDto } from './dto/user-role-query.dto.js';

type AuthenticatedRequest = Request & {
  user?: { sub?: string; permissions?: string[] };
};

@Controller({ path: 'users', version: '1' })
export class UserRolesController {
  constructor(private readonly userRoles: UserRoleService) {}

  @UseGuards(JwtAuthGuard, RoleReadAccessGuard)
  @Get(':userUuid/roles')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('userUuid') userUuid: string,
    @Query() query: UserRoleQueryDto,
  ) {
    return this.userRoles.list(this.actor(request), userUuid, query);
  }

  @UseGuards(JwtAuthGuard, RoleManageAccessGuard)
  @Post(':userUuid/roles')
  async assign(
    @Req() request: AuthenticatedRequest,
    @Param('userUuid') userUuid: string,
    @Body() dto: AssignUserRoleDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const assignment = await this.userRoles.assign(
      this.actor(request),
      userUuid,
      dto.roleUuid,
      this.auditContext(request, userAgent, requestId),
    );

    return {
      user: { uuid: assignment.userUuid },
      role: {
        uuid: assignment.roleUuid,
        name: assignment.roleName,
        code: assignment.roleCode,
      },
      assignedAt: assignment.assignedAt,
    };
  }

  @UseGuards(JwtAuthGuard, RoleManageAccessGuard)
  @Delete(':userUuid/roles/:roleUuid')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('userUuid') userUuid: string,
    @Param('roleUuid') roleUuid: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    await this.userRoles.remove(
      this.actor(request),
      userUuid,
      roleUuid,
      this.auditContext(request, userAgent, requestId),
    );
    return { success: true };
  }

  private actor(request: AuthenticatedRequest): RoleActor {
    if (!request.user?.sub) throw new Error('Authenticated actor missing');
    return {
      userUuid: request.user.sub,
      permissions: request.user.permissions ?? [],
    };
  }

  private auditContext(
    request: AuthenticatedRequest,
    userAgent?: string,
    requestId?: string,
  ): UserRoleMutationAuditContext {
    return { ipAddress: request.ip, userAgent, requestId };
  }
}
