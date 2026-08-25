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
import { RoleService } from '../application/services/role.service.js';
import type { RoleActor } from '../application/policies/role-authorization.policy.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RoleQueryDto } from './dto/role-query.dto.js';
import {
  RoleReadAccessGuard,
  RoleManageAccessGuard,
} from '../security/role-management-access.guard.js';
import { RoleSerializer } from './role.serializer.js';

type AuthenticatedRequest = Request & {
  user?: { sub?: string; permissions?: string[] };
};

@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RoleService) {}

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
}
