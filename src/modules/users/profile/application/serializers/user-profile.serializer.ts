import type { UserProfileEntity } from '../../domain/entities/user-profile.entity.js';

export interface UserProfileResponse {
  userUuid: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  avatarThumbnailUrl: string | null;
  timezone: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

export const serializeUserProfile = (
  profile: UserProfileEntity,
): UserProfileResponse => ({
  userUuid: profile.userUuid,
  firstName: profile.firstName,
  lastName: profile.lastName,
  imageUrl: profile.imageUrl,
  avatarThumbnailUrl: profile.avatarThumbnailUrl,
  timezone: profile.timezone,
  locale: profile.locale,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});
