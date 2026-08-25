import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../security/profile-authentication.guard.js';
import { ProfileAuthenticationGuard } from '../security/profile-authentication.guard.js';
import { CreateUserProfileDto } from '../application/dto/create-user-profile.dto.js';
import { UpdateUserProfileDto } from '../application/dto/update-user-profile.dto.js';
import { UserProfileService } from '../application/services/user-profile.service.js';
import { serializeUserProfile } from '../application/serializers/user-profile.serializer.js';
import {
  DuplicateUserProfileError,
  InvalidUserProfileError,
  UserProfileAccessDeniedError,
  UserProfileNotFoundError,
} from '../domain/errors/user-profile.errors.js';
import { UserNotFoundError } from '../../domain/errors/user.errors.js';

@Controller({ path: 'users', version: '1' })
@UseGuards(ProfileAuthenticationGuard)
export class UserProfileController {
  constructor(private readonly profiles: UserProfileService) {}

  @Post(':uuid/profile')
  async create(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: CreateUserProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      return serializeUserProfile(
        await this.profiles.create(request.user!, uuid, dto),
      );
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Get(':uuid/profile')
  async get(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      return serializeUserProfile(await this.profiles.get(request.user!, uuid));
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  @Patch(':uuid/profile')
  async update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateUserProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      return serializeUserProfile(
        await this.profiles.update(request.user!, uuid, dto),
      );
    } catch (error: unknown) {
      this.mapError(error);
    }
  }

  private mapError(error: unknown): never {
    if (error instanceof UserProfileAccessDeniedError) {
      throw new ForbiddenException('Profile ownership violation');
    }
    if (error instanceof UserNotFoundError || error instanceof UserProfileNotFoundError) {
      throw new NotFoundException('Profile or user not found');
    }
    if (error instanceof DuplicateUserProfileError) {
      throw new ConflictException('User profile already exists');
    }
    if (error instanceof InvalidUserProfileError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
