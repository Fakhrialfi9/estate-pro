import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/auth.module.js';
import {
  RolePermissionService,
  type RolePermissionMutationAuditContext,
} from '../application/services/role-permission.service.js';
import { RoleService } from '../application/services/role.service.js';
import type { RoleActor } from '../application/policies/role-authorization.policy.js';
import type { RolePermissionListQuery } from '../domain/repositories/role-permission.repository.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RoleQueryDto } from './dto/role-query.dto.js';
import { AssignRolePermissionDto } from './dto/assign-role-permission.dto.js';
import { RolePermissionQueryDto } from '../application/dto/role-permission-query.dto.js';
import {
  RoleReadAccessGuard,
  RoleManageAccessGuard,
} from '../security/role-management-access.guard.js';
import { RoleSerializer } from './role.serializer.js';
import { RolePermissionSerializer } from './role-permission.serializer.js';

type AuthenticatedRequest = Request & {
  user?: { sub?: string; permissions?: string[] };
};

@Controller('roles')
export class RolesController {
  constructor(
    private readonly roles: RoleService,
    private readonly rolePermissions: RolePermissionService,
  ) {}

  @UseGuards(JwtAuthGuard, RoleReadAccessGuard)
  @Get(':uuid')
  async get(@Req() request: AuthenticatedRequest, @Param('uuid') uuid: string) {
    const role = await this.roles.get(this.actor(request), uuid);
    return RoleSerializer.one(role);
  }

  @UseGuards(JwtAuthGuard, RoleReadAccessGuard)
  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: RoleQueryDto,
  ) {
    const result = await this.roles.list(this.actor(request), query);
    return RoleSerializer.list(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
  }

  @UseGuards(JwtAuthGuard, RoleReadAccessGuard)
  @Get(':uuid/permissions')
  async listPermissions(
    @Req() request: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Query() query: RolePermissionQueryDto,
  ) {
    const result = await this.rolePermissions.list(
      this.actor(request),
      uuid,
      query as RolePermissionListQuery,
    );
    return RolePermissionSerializer.list(result.role, result.assignments);
  }

  @UseGuards(JwtAuthGuard, RoleManageAccessGuard)
  @Post(':uuid/permissions')
  async assignPermission(
    @Req() request: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Body() dto: AssignRolePermissionDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const result = await this.rolePermissions.assign(
      this.actor(request),
      uuid,
      dto.permissionUuid,
      this.auditContext(request, userAgent, requestId),
    );
    return RolePermissionSerializer.assignment(result.role, result.permission);
  }

  @UseGuards(JwtAuthGuard, RoleManageAccessGuard)
  @Delete(':uuid/permissions/:permissionUuid')
  async removePermission(
    @Req() request: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Param('permissionUuid') permissionUuid: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    await this.rolePermissions.remove(
      this.actor(request),
      uuid,
      permissionUuid,
      this.auditContext(request, userAgent, requestId),
    );
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RoleManageAccessGuard)
  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateRoleDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const role = await this.roles.create(this.actor(request), dto, {
      ipAddress: request.ip,
      userAgent,
      requestId,
    });
    return RoleSerializer.one(role);
  }

  @UseGuards(JwtAuthGuard, RoleManageAccessGuard)
  @Put(':uuid')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateRoleDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const role = await this.roles.update(this.actor(request), uuid, dto, {
      ipAddress: request.ip,
      userAgent,
      requestId,
    });
    return RoleSerializer.one(role);
  }

  @UseGuards(JwtAuthGuard, RoleManageAccessGuard)
  @Delete(':uuid')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    await this.roles.delete(this.actor(request), uuid, {
      ipAddress: request.ip,
      userAgent,
      requestId,
    });
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
  ): RolePermissionMutationAuditContext {
    return { ipAddress: request.ip, userAgent, requestId };
  }
}
