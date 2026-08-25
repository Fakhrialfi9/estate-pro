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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/auth.module.js';
import {
  ROLE_MANAGE_PERMISSION,
  ROLE_READ_PERMISSION,
} from '../application/policies/role-authorization.policy.js';
import type { RoleActor } from '../application/policies/role-authorization.policy.js';
import {
  UserRoleService,
  type UserRoleMutationAuditContext,
} from '../application/services/user-role.service.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { AssignUserRoleDto } from './dto/assign-user-role.dto.js';
import { UserRoleQueryDto } from './dto/user-role-query.dto.js';

type AuthenticatedRequest = Request & {
  user?: { sub?: string; permissions?: string[] };
};

@ApiTags('User Roles')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class UserRolesController {
  constructor(private readonly userRoles: UserRoleService) {}

  @RequirePermissions(ROLE_READ_PERMISSION)
  @Get(':userUuid/roles')
  @ApiOperation({
    summary: 'List user roles',
    description: `Requires ${ROLE_READ_PERMISSION}.`,
  })
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('userUuid') userUuid: string,
    @Query() query: UserRoleQueryDto,
  ) {
    return this.userRoles.list(this.actor(request), userUuid, query);
  }

  @RequirePermissions(ROLE_MANAGE_PERMISSION)
  @Post(':userUuid/roles')
  @ApiOperation({
    summary: 'Assign role to user',
    description: `Requires ${ROLE_MANAGE_PERMISSION}; mandatory-admin and privilege-escalation protections are enforced by the application service.`,
  })
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

  @RequirePermissions(ROLE_MANAGE_PERMISSION)
  @Delete(':userUuid/roles/:roleUuid')
  @ApiOperation({
    summary: 'Remove role from user',
    description: `Requires ${ROLE_MANAGE_PERMISSION}; mandatory-admin protection is enforced by the application service.`,
  })
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
