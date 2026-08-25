import type {
  UserProfileEntity,
  UserProfileUpdate,
} from '../entities/user-profile.entity.js';

export interface CreateUserProfileData {
  userUuid: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  avatarThumbnailUrl?: string | null;
  timezone?: string;
  locale?: string;
}

export interface UserProfileRepository {
  create(data: CreateUserProfileData): Promise<UserProfileEntity>;
  findByUserUuid(userUuid: string): Promise<UserProfileEntity | null>;
  updateByUserUuid(
    userUuid: string,
    changes: UserProfileUpdate,
  ): Promise<UserProfileEntity>;
}

export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
