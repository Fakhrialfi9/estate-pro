import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UserManagementAccessGuard } from '../security/user-management-access.guard.js';
import { CreateUserDto } from '../application/dto/create-user.dto.js';
import { UpdateUserDto } from '../application/dto/update-user.dto.js';
import { UserQueryDto } from '../application/dto/user-query.dto.js';
import {
  DuplicateUserError,
  InvalidUserError,
  UserNotFoundError,
} from '../domain/errors/user.errors.js';
import type {
  UserFilterField,
  UserSortField,
} from '../domain/repositories/user.repository.js';
import { UserManagementService } from '../application/services/user-management.service.js';
import type { UserAuditContext } from '../application/services/user-management.service.js';
import { serializeUser } from '../application/serializers/user.serializer.js';
import {
  InvalidPasswordConfirmationError,
  InvalidPasswordError,
} from '../credentials/domain/errors/credential.errors.js';

type AuthenticatedRequest = Request & { user?: { sub?: string } };

const UUID_PIPE = new ParseUUIDPipe({ version: '4' });

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseGuards(UserManagementAccessGuard)
export class UsersController {
  constructor(private readonly users: UserManagementService) {}

  @Post()
  @ApiOperation({
    summary: 'Create user',
    description:
      'Requires users:manage authorization. Password and passwordConfirmation are required and are never returned.',
  })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateUserDto,
  ) {
    try {
      const user = await this.users.create(
        {
          ...(dto.username !== undefined ? { username: dto.username } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.status !== undefined
            ? { status: this.normalizeStatus(dto.status) }
            : {}),
        },
        {
          password: dto.password,
          confirmation: dto.passwordConfirmation,
        },
        this.auditContext(request),
      );
      return serializeUser(user);
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Get()
  @ApiOperation({
    summary: 'List users',
    description:
      'Requires users:manage authorization. Pagination, filtering and sorting are constrained by UserQueryDto allowlists.',
  })
  async list(@Query() dto: UserQueryDto) {
    if (dto.filterField && dto.filterValue === undefined)
      throw new BadRequestException('filterValue is required with filterField');
    if (
      dto.filterField === 'isActive' &&
      dto.filterValue !== undefined &&
      !['true', 'false'].includes(dto.filterValue.toLowerCase())
    )
      throw new BadRequestException(
        'isActive filterValue must be true or false',
      );
    const result = await this.users.list({
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      ...(dto.filterField !== undefined
        ? { filterField: dto.filterField as UserFilterField }
        : {}),
      ...(dto.filterValue !== undefined
        ? { filterValue: dto.filterValue }
        : {}),
      sortBy: (dto.sortBy ?? 'createdAt') as UserSortField,
      sortDirection: dto.sortDirection ?? 'desc',
      ...(dto.search !== undefined ? { search: dto.search.trim() } : {}),
    });
    return {
      items: result.items.map(serializeUser),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('email/:email')
  @ApiOperation({
    summary: 'Get user by email',
    description:
      'Requires users:manage authorization for privileged identity lookup.',
  })
  async getByEmail(@Param('email') email: string) {
    try {
      return serializeUser(await this.users.getByEmail(email));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Get('username/:username')
  @ApiOperation({
    summary: 'Get user by username',
    description:
      'Requires users:manage authorization for privileged identity lookup.',
  })
  async getByUsername(@Param('username') username: string) {
    try {
      return serializeUser(await this.users.getByUsername(username));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Get(':uuid')
  @ApiParam({
    name: 'uuid',
    description: 'User UUID',
    format: 'uuid',
    required: true,
  })
  @ApiOperation({
    summary: 'Get user',
    description:
      'A user may read their own record; other users require users:manage authorization.',
  })
  async getByUuid(@Param('uuid', UUID_PIPE) uuid: string) {
    try {
      return serializeUser(await this.users.getByUuid(uuid));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Patch(':uuid')
  @ApiParam({
    name: 'uuid',
    description: 'User UUID',
    format: 'uuid',
    required: true,
  })
  @ApiOperation({
    summary: 'Update user',
    description:
      'Requires users:manage authorization. Security-sensitive fields are not accepted by UpdateUserDto.',
  })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('uuid', UUID_PIPE) uuid: string,
    @Body() dto: UpdateUserDto,
  ) {
    try {
      const user = await this.users.update(
        uuid,
        {
          ...(dto.username !== undefined ? { username: dto.username } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.status !== undefined
            ? { status: this.normalizeStatus(dto.status) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        this.auditContext(request),
      );
      return serializeUser(user);
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Delete(':uuid')
  @HttpCode(204)
  @ApiParam({
    name: 'uuid',
    description: 'User UUID',
    format: 'uuid',
    required: true,
  })
  @ApiOperation({
    summary: 'Deactivate user',
    description:
      'Requires users:manage authorization and performs a soft delete with session invalidation.',
  })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('uuid', UUID_PIPE) uuid: string,
  ): Promise<void> {
    try {
      await this.users.remove(uuid, this.auditContext(request));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  private auditContext(request: AuthenticatedRequest): UserAuditContext {
    return {
      ...(request.user?.sub !== undefined
        ? { actorUuid: request.user.sub }
        : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(request.get('user-agent') !== undefined
        ? { userAgent: request.get('user-agent') }
        : {}),
      ...(request.get('x-request-id') !== undefined
        ? { requestId: request.get('x-request-id') }
        : {}),
    };
  }

  private normalizeStatus(value: string) {
    const status = value.trim().toLowerCase();
    if (!['pending', 'active', 'inactive', 'suspended'].includes(status))
      throw new InvalidUserError('Invalid user status');
    return status as 'pending' | 'active' | 'inactive' | 'suspended';
  }

  private mapError(error: unknown): never {
    if (error instanceof UserNotFoundError)
      throw new NotFoundException('User not found');
    if (
      error instanceof DuplicateUserError ||
      (error as { name?: string }).name === 'DuplicateUserError'
    )
      throw new ConflictException('User identity is already in use');
    if (error instanceof InvalidUserError)
      throw new BadRequestException(error.message);
    if (error instanceof InvalidPasswordConfirmationError)
      throw new BadRequestException(error.message);
    if (error instanceof InvalidPasswordError)
      throw new BadRequestException(error.message);
    throw error;
  }
}
