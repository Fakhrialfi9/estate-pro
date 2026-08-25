import { Inject, Injectable } from '@nestjs/common';
import {
  DuplicateUserProfileError,
  InvalidUserProfileError,
  UserProfileNotFoundError,
} from '../../domain/errors/user-profile.errors.js';
import type { UserProfileUpdate } from '../../domain/entities/user-profile.entity.js';
import type { UserProfileEntity } from '../../domain/entities/user-profile.entity.js';
import type {
  CreateUserProfileData,
  UserProfileRepository,
} from '../../domain/repositories/user-profile.repository.js';
import { USER_PROFILE_REPOSITORY } from '../../domain/repositories/user-profile.repository.js';
import type { AuthenticatedPrincipal } from '../types/authenticated-principal.js';
import type { UserIdentityReader } from '../types/user-identity-reader.js';
import { USER_IDENTITY_READER } from '../types/user-identity-reader.js';
import { UserProfileOwnershipPolicy } from '../policies/user-profile-ownership.policy.js';

@Injectable()
export class UserProfileService {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly profiles: UserProfileRepository,
    @Inject(USER_IDENTITY_READER)
    private readonly users: UserIdentityReader,
    private readonly ownership: UserProfileOwnershipPolicy,
  ) {}

  async create(
    principal: AuthenticatedPrincipal,
    userUuid: string,
    data: Omit<CreateUserProfileData, 'userUuid'>,
  ): Promise<UserProfileEntity> {
    this.ownership.assertCanManage(principal, userUuid);
    await this.users.getByUuid(userUuid);
    const existing = await this.profiles.findByUserUuid(userUuid);
    if (existing) throw new DuplicateUserProfileError();

    const normalized = this.normalize(data);
    return this.profiles.create({ userUuid, ...normalized });
  }

  async get(
    principal: AuthenticatedPrincipal,
    userUuid: string,
  ): Promise<UserProfileEntity> {
    this.ownership.assertCanManage(principal, userUuid);
    await this.users.getByUuid(userUuid);
    const profile = await this.profiles.findByUserUuid(userUuid);
    if (!profile) throw new UserProfileNotFoundError();
    return profile;
  }

  async update(
    principal: AuthenticatedPrincipal,
    userUuid: string,
    changes: UserProfileUpdate,
  ): Promise<UserProfileEntity> {
    this.ownership.assertCanManage(principal, userUuid);
    await this.users.getByUuid(userUuid);
    const existing = await this.profiles.findByUserUuid(userUuid);
    if (!existing) throw new UserProfileNotFoundError();

    const normalized = this.normalize(changes);
    return this.profiles.updateByUserUuid(userUuid, normalized);
  }

  private normalize(
    data: Omit<CreateUserProfileData, 'userUuid'> | UserProfileUpdate,
  ): UserProfileUpdate {
    const normalizeNullable = (value: string | null): string | null => {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    };

    const normalized: UserProfileUpdate = {};

    if (data.firstName !== undefined) {
      normalized.firstName =
        data.firstName === null ? null : normalizeNullable(data.firstName);
    }
    if (data.lastName !== undefined) {
      normalized.lastName =
        data.lastName === null ? null : normalizeNullable(data.lastName);
    }
    if (data.imageUrl !== undefined) {
      normalized.imageUrl =
        data.imageUrl === null ? null : normalizeNullable(data.imageUrl);
    }
    if (data.avatarThumbnailUrl !== undefined) {
      normalized.avatarThumbnailUrl =
        data.avatarThumbnailUrl === null
          ? null
          : normalizeNullable(data.avatarThumbnailUrl);
    }
    if (data.timezone !== undefined) {
      normalized.timezone = data.timezone.trim();
    }
    if (data.locale !== undefined) {
      normalized.locale = data.locale.trim();
    }

    if (
      normalized.firstName !== undefined &&
      normalized.firstName !== null &&
      normalized.firstName.length > 100
    ) {
      throw new InvalidUserProfileError('Invalid firstName');
    }
    if (
      normalized.lastName !== undefined &&
      normalized.lastName !== null &&
      normalized.lastName.length > 100
    ) {
      throw new InvalidUserProfileError('Invalid lastName');
    }
    if (
      normalized.imageUrl !== undefined &&
      normalized.imageUrl !== null &&
      normalized.imageUrl.length > 500
    ) {
      throw new InvalidUserProfileError('Invalid imageUrl');
    }
    if (
      normalized.avatarThumbnailUrl !== undefined &&
      normalized.avatarThumbnailUrl !== null &&
      normalized.avatarThumbnailUrl.length > 500
    ) {
      throw new InvalidUserProfileError('Invalid avatarThumbnailUrl');
    }
    if (
      normalized.timezone !== undefined &&
      (!normalized.timezone || normalized.timezone.length > 100)
    ) {
      throw new InvalidUserProfileError('Invalid timezone');
    }
    if (
      normalized.locale !== undefined &&
      !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(normalized.locale)
    ) {
      throw new InvalidUserProfileError('Invalid locale');
    }

    return normalized;
  }
}
