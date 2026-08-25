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
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { serializeUser } from '../application/serializers/user.serializer.js';

@Controller({ path: 'users', version: '1' })
@UseGuards(UserManagementAccessGuard)
export class UsersController {
  constructor(private readonly users: UserManagementService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    try {
      const user = await this.users.create({
        ...(dto.username !== undefined ? { username: dto.username } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.status !== undefined
          ? { status: this.normalizeStatus(dto.status) }
          : {}),
      });
      return serializeUser(user);
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Get()
  async list(@Query() dto: UserQueryDto) {
    if (dto.filterField && dto.filterValue === undefined) {
      throw new BadRequestException('filterValue is required with filterField');
    }
    if (
      dto.filterField === 'isActive' &&
      dto.filterValue !== undefined &&
      !['true', 'false'].includes(dto.filterValue.toLowerCase())
    ) {
      throw new BadRequestException(
        'isActive filterValue must be true or false',
      );
    }

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
  async getByEmail(@Param('email') email: string) {
    try {
      return serializeUser(await this.users.getByEmail(email));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Get('username/:username')
  async getByUsername(@Param('username') username: string) {
    try {
      return serializeUser(await this.users.getByUsername(username));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Get(':uuid')
  async getByUuid(@Param('uuid') uuid: string) {
    try {
      return serializeUser(await this.users.getByUuid(uuid));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Patch(':uuid')
  async update(@Param('uuid') uuid: string, @Body() dto: UpdateUserDto) {
    try {
      const user = await this.users.update(uuid, {
        ...(dto.username !== undefined ? { username: dto.username } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.status !== undefined
          ? { status: this.normalizeStatus(dto.status) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      });
      return serializeUser(user);
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Delete(':uuid')
  @HttpCode(204)
  async remove(@Param('uuid') uuid: string): Promise<void> {
    try {
      await this.users.remove(uuid);
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  private normalizeStatus(value: string) {
    const status = value.trim().toLowerCase();
    if (!['pending', 'active', 'inactive', 'suspended'].includes(status)) {
      throw new InvalidUserError('Invalid user status');
    }
    return status as 'pending' | 'active' | 'inactive' | 'suspended';
  }

  private mapError(error: unknown): never {
    if (error instanceof UserNotFoundError) {
      throw new NotFoundException('User not found');
    }
    if (
      error instanceof DuplicateUserError ||
      (error as { name?: string }).name === 'DuplicateUserError'
    ) {
      throw new ConflictException('User identity is already in use');
    }
    if (error instanceof InvalidUserError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
