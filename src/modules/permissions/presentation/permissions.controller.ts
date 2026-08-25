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
  PermissionService,
  type PermissionMutationAuditContext,
} from '../application/services/permission.service.js';
import type { PermissionActor } from '../application/policies/permission-authorization.policy.js';
import { CreatePermissionDto } from './dto/create-permission.dto.js';
import { UpdatePermissionDto } from './dto/update-permission.dto.js';
import { PermissionQueryDto } from './dto/permission-query.dto.js';
import {
  PermissionReadAccessGuard,
  PermissionManageAccessGuard,
} from '../security/permission-management-access.guard.js';
import { PermissionSerializer } from './permission.serializer.js';

type AuthenticatedRequest = Request & {
  user?: { sub?: string; permissions?: string[] };
};

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionService) {}

  @UseGuards(JwtAuthGuard, PermissionReadAccessGuard)
  @Get(':uuid')
  async get(@Req() request: AuthenticatedRequest, @Param('uuid') uuid: string) {
    const permission = await this.permissions.get(this.actor(request), uuid);
    return PermissionSerializer.one(permission);
  }

  @UseGuards(JwtAuthGuard, PermissionReadAccessGuard)
  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: PermissionQueryDto,
  ) {
    const result = await this.permissions.list(this.actor(request), query);
    return PermissionSerializer.list(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionManageAccessGuard)
  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePermissionDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const permission = await this.permissions.create(
      this.actor(request),
      dto,
      this.auditContext(request, userAgent, requestId),
    );
    return PermissionSerializer.one(permission);
  }

  @UseGuards(JwtAuthGuard, PermissionManageAccessGuard)
  @Put(':uuid')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Body() dto: UpdatePermissionDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const permission = await this.permissions.update(
      this.actor(request),
      uuid,
      dto,
      this.auditContext(request, userAgent, requestId),
    );
    return PermissionSerializer.one(permission);
  }

  @UseGuards(JwtAuthGuard, PermissionManageAccessGuard)
  @Delete(':uuid')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    await this.permissions.delete(
      this.actor(request),
      uuid,
      this.auditContext(request, userAgent, requestId),
    );
    return { success: true };
  }

  private actor(request: AuthenticatedRequest): PermissionActor {
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
  ): PermissionMutationAuditContext {
    return { ipAddress: request.ip, userAgent, requestId };
  }
}
